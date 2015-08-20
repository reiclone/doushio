/*
    TODO
 */
'use strict';

let wordSearchMod = require("./wordsearch"),
    config = require("../../config"),
    async = require('async'),
    redis = require('redis').createClient();

let wordStructures = {};

//regex for all punctuation including unicode. !Excluding # and ~!
const punctUnicode = /[\u2000-\u206F\u2E00-\u2E7F\\'!"$%&()*+,\-.\/:;<=>?@\[\]^_`{|}\n]/g;

function load(){
    async.each(config.BOARDS,loadBoard);
}
exports.load = load;
function loadBoard(currboard,cb) {
    wordStructures[currboard] = wordSearchMod.WordStructure();
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
                    const threadInd=wordStructures[currboard].GetThreadIndex(num);
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
                    m.hget(key[1], 'body');
                m.exec(next);
            },
            function (bodies, next) {
                let pind=0;
                for (let i = 0; i < bodies.length; i++)
                    addText(bodies[i],posts[pind++],currboard);
                next();
            }
        ],
        function (err) {
            if (err)
                return console.error(err);
            cb();
        }
    )
}
function search(word,board){
    return wordStructures[board].Search(word);
}
exports.search = search;

function addText(text,threadid,board){
    if(!text)
        return;
    let cword;
    for(let word of text.split(/[\s,]+/)){
        cword=word.toLowerCase().replace(punctUnicode,"");
        if(cword.length>0)
           wordStructures[board].AddWord(cword,threadid,1);
    }
}
exports.addText =addText;

function deleteThread(threadid,board){
    wordStructures[board].DeleteWordsFromThread(threadid);
}
exports.deleteThread =deleteThread;

function getThreadId(thread,board){
    return wordStructures[board].GetThreadIndex(thread);
}
exports.getThreadIndex = getThreadId;