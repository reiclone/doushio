/*
    Houses structures with all the words and data about which thread do they appear in.
 */
'use strict';

let wordSearchMod = require("./wordsearch"),
    config = require("../../config"),
    async = require('async'),
    common = require('../../common'),
    redis = require('redis').createClient();

let wordStructures = {};

function load(){
    async.each(config.BOARDS,loadBoard);
}
exports.load = load;
function loadBoard(currboard,cb) {
    wordStructures[currboard] = wordSearchMod.WordStructure();
    const currboardDel=getDel(currboard);
    wordStructures[currboardDel] = wordSearchMod.WordStructure();//handles the deleted posts of that board
    let threadI =[],
            posts =[],
        keys = new Map();

    async.waterfall(
        [
            function (next) {
                // Read thread list
                redis.zrevrange(`tag:${currboard.length}:${currboard}:threads`, 0, -1, next);
            },
            function (threads, next) {
                if (!threads.length)
                    return;

                // Read reply list for each thread
                let m = redis.multi();
                for (let num of threads) {
                    const key = `thread:${num}`;
                    const threadInd=[wordStructures[currboard].GetThreadIndex(num),
                                     wordStructures[currboardDel].GetThreadIndex(num)];
                    threadI.push(threadInd);
                    keys.set(num,key);
                    posts.push(threadInd);
                    m.lrange(key + ':posts', 0, -1);
                }
                m.exec(next);
            },
            function (replyLists, next) {
                // Add each reply to array of keys to read
                let tind=-1;
                for (let replies of replyLists) {
                    tind++;
                    if (!replies.length)
                        continue;
                    for (let num of replies) {
                        keys.set(num, 'post:' + num);
                        posts.push(threadI[tind]);
                    }
                }
                // Read the body of each key
                let m = redis.multi();
                for (let key of keys)
                    m.hmget(key[1], 'body','deleted');
                m.exec(next);
            },
            function (results, next) { //results is an array of arrays [body,deleted]
                let pind=0;
                for (let i = 0; i < results.length; i++){
                    if(results[i][1]) //if deleted
                        addText(results[i][0],posts[pind++][1],currboardDel);
                    else
                        addText(results[i][0],posts[pind++][0],currboard);
                }
                next();
            }
        ],
        function (err) {
            if (err)
                return winston.error('Word search error:',err);
            cb();
        }
    )
}
//if auth is true, we will also search in the deleted posts
function search(word,board,auth){
    let buf = wordStructures[board].Search(word);
    if(auth)
        buf+= wordStructures[getDel(board)].Search(word);
    return buf;
}
exports.search = search;

//Uses threadid, which you should get through getThreadIndex before
function addText(text,threadid,board){
    common.splitToWords(text,(word)=>wordStructures[board].AddWord(word,threadid,1));
}
exports.addText = addText;

function deleteThread(thread,board){
    const boardDel= getDel(board);
    const nId = getThreadId(thread,board);
    const dId = getThreadId(thread,boardDel);
    wordStructures[board].DeleteWordsFromThread(nId);
    wordStructures[boardDel].DeleteWordsFromThread(dId);
}
exports.deleteThread =deleteThread;

function getThreadId(thread,board){
    return wordStructures[board].GetThreadIndex(thread);
}
exports.getThreadIndex = getThreadId;

function moveToDel(text,thread,board){
    const boardDel= getDel(board);
    const oldId = getThreadId(thread,board);
    const newId = getThreadId(thread,boardDel);
    common.splitToWords(text,function(word){
        wordStructures[board].AddWord(word, oldId, -1);
        wordStructures[boardDel].AddWord(word, newId, 1);
    });
}
exports.moveToDel=moveToDel;

function getDel(board){
    return board+"_del";
}