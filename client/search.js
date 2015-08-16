/*
 * Houses the client responsabilites for searching.
 */

let main = require('./main'),
    {$, _, Backbone, common, lang, state} = main;

function load() {
    const $el = $('#searchBox');
    const $text = $el.find('#searchText');

    //Some hacky css formatting
    $('aside.act:nth-child(4)').css("display","inline-block"); //change css on the "New Thread" button.
    function sendSearchQuery(){
        let text =$text[0].value;
        if(text.length>0)
            main.request('send', [common.SEARCH_QUERY,text.toLowerCase()]);
        else{
            if (state.page.get('catalog')){ //No search, return default state
                $('.search_inf').remove();
                $('article').show();
            }
        }
    }
    $el.find('#searchBut').click(()=> sendSearchQuery());
    $text.keypress(function(e){
        if(e.which==13)
            sendSearchQuery();
    });
}
exports.load = load;

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
            if(title && title.indexOf(word)>-1)
                n++;
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