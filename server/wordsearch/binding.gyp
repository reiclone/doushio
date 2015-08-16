{
    "targets": [
        {
            "target_name": "wordsearch",
            "include_dirs" : [
                "<!(node -e \"require('nan')\")"
            ],
            "sources": [ "wordsearch.cpp","wordstructure.cpp"]
        }
    ]
}
