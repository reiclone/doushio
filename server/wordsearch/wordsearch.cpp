#include <nan.h>
#include "wordstructure.h"

using namespace v8;

void Init(Handle<Object> exports) {
	WordStructure::Init(exports);
}
NODE_MODULE(wordsearch,Init)
