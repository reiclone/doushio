#include "wordstructure.h"
#include <iostream>
#include <sstream> //String stream
#include <algorithm> //find
/* This object contains the data structures needed to save the following data
 * 	-List of threads
 * 	-List of times each word is in each thread
 * It assigns to each thread it's own id so adding and searching for a single word "anon" would work like this:
 * 	Loading the module:
 * 		let wordSearchMod = require('./wordsearch');
 * 		let boardXStruct = wordSearchMod.WordStructure()
 *	Adding the word contained in thread "12345":
 * 		const ind = boardXStruct.GetThreadIndex("12345"); //returns 0
 * 		boardXStruct.AddWord("anon",ind,1); //where the 1 is the number of times this word has been added to the thread
 * 	Searching for a word:
 * 		boardXStruct.Search("anon"); //Returns "12345:1|12346:3|"
 * 		boardXStruct.Search("nonexistingword"); //Returns ""
 * 	Deleting info about thread "123456":
 * 		const ind = boardXStruct.GetThreadIndex("12346"); //returns 1
 * 		boardXStruct.DeleteWordsFromThread(ind);
 * Warning:
 * 	Search will only match exactly the same string.
 * 		Searching for "anon" won't match "anon."
 * 		Searching for "Anon" won't match "anon"
 * 		Searching for "Ano" won't match "anon"
 */

using namespace v8;

Nan::Persistent<Function> WordStructure::constructor;
WordStructure::WordStructure()
{
}

WordStructure::~WordStructure()
{
}

NAN_MODULE_INIT(WordStructure::Init){
  Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("WordStructure").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(2);

  Nan::SetPrototypeMethod(tpl,"AddWord",AddWord);
  Nan::SetPrototypeMethod(tpl,"DeleteWordsFromThread",DeleteWordsFromThread);
  Nan::SetPrototypeMethod(tpl,"Search",Search);
  Nan::SetPrototypeMethod(tpl,"GetThreadIndex",GetThreadIndex);

  constructor.Reset(tpl->GetFunction());
  Nan::Set(target,
            Nan::New("WordStructure").ToLocalChecked(),
            tpl->GetFunction());
}

NAN_METHOD(WordStructure::New){

  if(info.IsConstructCall()){
    WordStructure* obj;
    obj=new WordStructure();
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  }else {
    Local<Function> cons = Nan::New<Function>(constructor);
    info.GetReturnValue().Set(cons->NewInstance());
  }
}

NAN_METHOD(WordStructure::AddWord){
    WordStructure* obj = ObjectWrap::Unwrap<WordStructure>(info.Holder());
    
    String::Utf8Value wordUcs2(info[0]);
    std::string word=std::string(*wordUcs2);
    uint8_t thread = info[1]->Uint32Value();
    unsigned int n = info[2]->Uint32Value();
    obj->Rbtree[word][thread]+=n;
    info.GetReturnValue().SetNull();
}

NAN_METHOD(WordStructure::DeleteWordsFromThread){
    WordStructure* obj = ObjectWrap::Unwrap<WordStructure>(info.Holder());
    unsigned int thread = info[0]->Uint32Value();

    if(thread<obj->ThreadList.size()){
        for(std::map<std::string,std::map<uint8_t,unsigned int>>::iterator it =obj->Rbtree.begin(); it != obj->Rbtree.end(); ++it)
            (it->second).erase(thread);
        obj->ThreadList[thread].clear();
    }
    info.GetReturnValue().SetNull();
}

NAN_METHOD(WordStructure::Search){
    WordStructure* obj = ObjectWrap::Unwrap<WordStructure>(info.Holder());
    
    String::Utf8Value wordUcs2(info[0]);
    std::string word=std::string(*wordUcs2);
    std::stringstream output;
    std::map<uint8_t,unsigned int> r = obj->Rbtree[word];
    std::vector<std::string> t = obj->ThreadList;
    //check null
    for(std::map<uint8_t,unsigned int>::iterator it = r.begin(); it != r.end(); ++it)
        output<< t[(it->first)]<<":"<<(it->second)<<"|";
    info.GetReturnValue().Set(Nan::New<String>(output.str()).ToLocalChecked());
}
NAN_METHOD(WordStructure::GetThreadIndex){
    WordStructure* obj = ObjectWrap::Unwrap<WordStructure>(info.Holder());

    String::Utf8Value threadUcs2(info[0]);
    std::string thread=std::string(*threadUcs2);

    std::vector<std::string>::iterator it = std::find(obj->ThreadList.begin(),obj->ThreadList.end(),thread);
    if(it==obj->ThreadList.end()){
        for(std::vector<std::string>::iterator vit = obj->ThreadList.begin(); vit!= obj->ThreadList.end(); ++vit)
            if((*vit).empty()){
                (*vit)=thread;
                info.GetReturnValue().Set(Nan::New<Number>(std::distance(obj->ThreadList.begin(),vit)));
                return;
            }
        info.GetReturnValue().Set((int)obj->ThreadList.size());
        obj->ThreadList.push_back(thread);
        return;
    }else
       info.GetReturnValue().Set((int)std::distance(obj->ThreadList.begin(),it));
}