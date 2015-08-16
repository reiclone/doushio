#ifndef WORDSTRUCTURE_H
#define WORDSTRUCTURE_H
#include <string>
#include <map>
#include <vector>
#include <nan.h>
#include <cstdint>
class WordStructure: public Nan::ObjectWrap
{
public:
    static NAN_MODULE_INIT(Init);
private:
    WordStructure();
    ~WordStructure();
    static NAN_METHOD(New);
    static NAN_METHOD(AddWord);
    static NAN_METHOD(DeleteWordsFromThread);
    static NAN_METHOD(Search);
    static NAN_METHOD(GetThreadIndex);
    static Nan::Persistent<v8::Function> constructor;

    std::map<std::string,std::map<uint8_t,unsigned int>> Rbtree;
    std::vector<std::string> ThreadList;
};

#endif // WORDSTRUCTURE_H
