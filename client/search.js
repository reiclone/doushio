/*
 * Houses the client responsabilites for searching.
 */

let main = require('./main'),
    {$, _, Backbone, common, lang, state} = main;

//The results are in a string with the folowing format
//Thread1:nTimesWordInThread1|Thread2:nTimesWordInThread2|...|ThreadX:nTimesWordInThreadX|
//Or an empty string if no results are found
function HighlightResults(results) {
    const threadnum = results[0].split("|");
    let threads ={};
    for(let i=0; i<threadnum.length-1;i++){ //Last one won't have threadinfo
        const threadinfo = threadnum[i].split(':');
        threads[threadinfo[0]]=threadinfo[1];
    }
    if (state.page.get('catalog')){
        $('.search_inf').remove();
        let found = false;
        const word = $('#searchText')[0].value;
        $('article').each(function (i) {
            const hist = $(this).find('.history').first();
            const $title= $(this).find('h3');
            const title = ($title)? $title.text().toLowerCase():null;
            let n =0;
            n+=parseInt(threads[hist.attr('href')] || 0);
            if(title)
                common.splitToWords(title,function(tword){
                    if(word===tword)
                        n++;
                });
            if (n>0) {
                found=true;
                hist.before('<span class="search_inf">' + n + '</span>');
                $(this).show();
            } else
                $(this).hide();
        });
        if(!found) {
            $("#catalog").after('<p class="search_inf">' + lang.noresults + '</p>');
            $("article").hide();
        }
    }
}
exports.HighlightResults = HighlightResults;

main.$threads.on('submit','#searchBox',function(e){
    let text =$('#searchText')[0].value;
    if(text.length>0)
        main.request('send', [common.SEARCH_QUERY,text.toLowerCase()]);
    else{
        if (state.page.get('catalog')){ //No search, return default state
            $('.search_inf').remove();
            $('article').show();
        }
    }
    e.preventDefault();
});