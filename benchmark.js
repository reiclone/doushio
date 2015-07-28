/*
Basic synchronous and asynchronous benchmarks for individual functional units
 */
'use strict';
// Usage examples
/*let number = 0;
benchmark('Addition', 1000, function () {
	number++;
});

let redis = require('redis').createClient();
asyncBenchmark('Redis ping', 1000, function (cb) {
	redis.ping(cb);
});*/
let async = require('async');
//Config
const boardTag = "1:a";
const iter = 1000;
const word = "#pyu";

let redis = require('redis').createClient();
let results;
asyncBenchmark('SearchTest',iter,function(cb){
	results ={};
	redis.zrevrange("tag:"+boardTag+":threads",0,-1,function(err,threads) { //get threads
		if (err)
			console.log("Error getting threads",err);
		else
			async.each(threads,function(thread,cb2){
				handleThread(thread,cb2);
			},cb);
	});
},function(){
	console.log(results);
});
function handleThread(thread,cb2){
	redis.lrange("thread:"+thread+":posts",0,-1,function(err,posts){
		if(err)
			return cb2(err);
		async.each(posts,function(post,cb3){
			redis.hget("post:" + post, "body", function (err, body) {
				if(err)
					return cb3(err);
				if (body.indexOf(word) >= 0)
					results[thread] = (results[thread]||0)+1;
				return cb3();
			});
		},cb2);
	});
}
function benchmark(name, iterations, func) {
	console.time(name);
	for (let i = 0; i < iterations; i++) {
		func();
	}
	console.timeEnd(name);
}

function asyncBenchmark(name, iterations, func, next) {
	console.time(name);
	let i = 0;
	loop();

	function loop() {
		// The benchmarked function must take a callback as its only argument
		func(++i < iterations ? loop : finish);
	}

	function finish() {
		console.timeEnd(name);
		// Execute next async benchmark
		if (next)
			next();
		else
			process.exit();
	}
}