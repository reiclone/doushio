all: wordsearch.node

wordsearch.node: build wordsearch.cpp
	node-gyp build
	@cp build/Release/$@ $@

build: binding.gyp
	node-gyp configure

.PHONY: all clean

clean:
	rm -rf -- .build build wordsearch.node
