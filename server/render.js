/*
 Renders the server-side portion of the HTML
 */

let _ = require('underscore'),
	caps = require('./caps'),
	common = require('../common/index'),
	config = require('../config'),
	db = require('../db'),
	lang = require('../lang/'),
	STATE = require('./state');

let RES = STATE.resources,
	actionLink = common.action_link_html,
	escape = common.escape_html,
	parseHTML = common.parseHTML;

class Render {
	constructor(yaku, req, resp, opts) {
		this.resp =resp;
		this.req = req;
		this.parseRequest();
		opts.ident = req.ident;
		this.opts = opts;
		// Stores serialized post models for later stringification
		this.posts = {};
		this.initOneeSama();
		this.hidden = this.parseIntCookie('hide');

		// Top and bottom borders of the page
		yaku.once('top', this.onTop.bind(this));
		yaku.once('bottom', this.onBottom.bind(this));

		yaku.on('thread', this.onThread.bind(this));
		// These are useless on catalog pages, as the events never fire
		if (!opts.catalog) {
			yaku.on('endthread', this.onThreadEnd.bind(this));
			yaku.on('post', this.onPost.bind(this));
		}
	}
	parseRequest() {
		let req = this.req;
		// Entire page, not just the contents of threads
		this.full = req.query.minimal !== 'true';
		this.lang = req.lang;
	}
	// Configure rendering singleton
	initOneeSama() {
		const ident = this.req.ident,
			cookies = this.req.cookies,
			mine = this.parseIntCookie('mine');
		let links = this.links = {};
		let oneeSama = new common.OneeSama({
			spoilToggle: cookies.spoil === 'true',
			autoGif: cookies.agif === 'true',
			eLinkify: cookies.linkify === 'true',
			lang: lang[this.lang].common,
			catalog: this.opts.catalog,

			// Post link handler
			tamashii(num) {
				const op = db.OPs[num];
				if (op && caps.can_access_thread(ident, op)) {
					const desc = mine.has(num) && this.lang.you;
					this.callback(this.postRef(num, op, desc));
					// Pass verified post links to the client
					links[num] = op;
				}
				else
					this.callback('>>' + num);
			}
		});

		if (common.thumbStyles.indexOf(cookies.thumb) >= 0)
			oneeSama.thumbStyle = cookies.thumb;
		let lastN = cookies.lastn && parseInt(cookies.lastn, 10);
		if (!lastN || !common.reasonable_last_n(lastN))
			lastN = STATE.hot.THREAD_LAST_N;
		oneeSama.lastN = lastN;
		this.oneeSama = oneeSama;
		return this;
	}
	// Parse list string from cookie into a set of integers
	parseIntCookie(name) {
		let ints = new Set();
		const cookie = this.req.cookies[name];
		if (cookie) {
			let split = cookie.split('/');
			for (let i = 0, l = split.length; i < l; i++) {
				ints.add(parseInt(split[i], 10));
			}
		}
		return ints;
	}
	onTop(nav) {
		let resp = this.resp;
		const opts = this.opts;

		// <head> and other prerendered static HTML
		if (this.full)
			resp.write(this.templateTop());
		if (opts.catalog)
			this.boardTitle().catalogTop();
		else if (opts.isThread)
			this.threadTitle().threadTop();
		else
			this.boardTitle().pagination(nav);
		resp.write('<hr>\n');

		// Only render on 'live' board pages
		if (opts.live && !config.READ_ONLY)
			resp.write(this.oneeSama.newThreadBox());
		if (opts.catalog){
			resp.write(this.searchBox());
			resp.write('<div id="catalog">');
		}
	}
	templateTop() {
		// Templates are generated one per language and cached
		const tmpl = this.tmpl = RES['indexTmpl-' + this.lang];
		return tmpl[0] + this.imageBanner() + tmpl[1];
	}
	onBottom() {
		let resp = this.resp;
		const catalog = this.opts.catalog;
		if (catalog)
			resp.write('</div><hr>\n');
		resp.write(this.pag || this.threadBottom());

		/*
		 Build backbone model skeletons server-side, so there is less work to be
		 done on the client.
		 NOTE: We could use something like rendr.js in the future.
		 */
		resp.write(parseHTML
			`<script id="postData" type="application/json">
				${JSON.stringify({
					posts: this.posts,
					title: this.title,
					links: this.links
				})}
			</script>`
		);
		if (this.full)
			this.pageEnd();
	}
	onThread(post) {
		if (this.hidden.has(post.num))
			return;

		// Regular threads and catalog have very different structure, se we
		// split them into methods
		if (this.opts.catalog)
			this.catalogThread(post);
		else
			this.writeThread(post);
	}
	catalogThread(data) {
		let safe = common.safe,
			html = [safe('<article>')],
			oneeSama = this.oneeSama;

		// Downscale thumbnail
		let image = data.image;
		image.dims[2] /= 1.66;
		image.dims[3] /= 1.66;

		html.push(
			safe(oneeSama.thumbnail(image, data.num)),
			safe(parseHTML
				`<br>
				<small>
					<span title="${lang[this.lang].catalog_omit}">
						${data.replyctr}/${data.imgctr - 1}
					</span>
					${oneeSama.expansionLinks(data.num)}
				</small>
				<br>`
			)
		);
		if (data.subject)
			html.push(safe('<h3>「'), data.subject, safe('」</h3>'));
		html.push(oneeSama.body(data.body), safe('</article>'));
		this.resp.write(common.join(html));
	}
	writeThread(post) {
		this.posts[post.num] = post;

		let oneeSama = this.oneeSama;
		const opts = this.opts,
			full = oneeSama.full = !!opts.fullPosts;
		oneeSama.op = opts.fullLinks ? false : post.num;
		let first = oneeSama.section(post, full && 'full');
		first.pop();
		this.resp.write(first.join(''));
	}
	onThreadEnd(num) {
		if (this.hidden.has(num))
			return;
		let resp = this.resp;
		if (!config.READ_ONLY)
			resp.write(this.oneeSama.replyBox());
		resp.write('</section><hr>\n');
	}
	onPost(post) {
		const hidden = this.hidden;
		if (hidden.has(post.num) || hidden.has(post.op))
			return;
		let posts = this.posts;
		posts[post.num] = post;
		this.resp.write(this.oneeSama.article(post));
	}
	threadTitle() {
		let title = `/${escape(this.opts.board)}/ - `;
		const subject = this.opts.subject,
			op = this.opts.op;
		if (subject)
			title += `${escape(subject)} (#${op})`;
		else
			title += `#${op}`;
		this.resp.write(`<h1>${title}</h1>`);
		this.title = title;
		return this;
	}
	boardTitle() {
		const board = this.opts.board,
			title = STATE.hot.TITLES[board] || escape(board);
		this.resp.write(`<h1>${title}</h1>`);
		this.title = title;
		return this;
	}
	imageBanner() {
		const banners = STATE.hot.BANNERS;
		if (!banners)
			return '';
		return `<img src="${config.MEDIA_URL}banners/${common.random(banners)}">`;
	}
	searchBox() {
		const lang = this.oneeSama.lang;
		return '<aside id="searchBox">' +
				'<input type="text" id="searchText" placeholder="'+lang.search+'">' +
				'<input type="submit" id="searchBut" value="">' +
				'</aside><div style="clear:both"></div>';
	}
	catalogTop() {
		const pag = this.oneeSama.asideLink('return', '.', 'compact', 'history');
		this.resp.write(pag);
		// Assign to this.pag, to make duplicating at bottom more uniform
		this.pag = pag;
	}
	threadTop() {
		let lang = this.oneeSama.lang;
		this.resp.write(
			actionLink('#bottom', lang.bottom)
				+ '&nbsp;'
				+ actionLink('', lang.expand_images, 'expandImages')
		);
	}
	// [live 0 1 2 3] [Catalog]
	pagination(nav) {
		let oneeSama = this.oneeSama;
		const live = oneeSama.lang.live,
			cur = nav.cur_page;
		let bits = '<nav class="pagination act">';
		if (cur >= 0)
			bits += `<a href="." class="history">${live}</a>`;
		else
			bits += `<strong>${live}</strong>`;
		let start = 0,
			end = nav.pages,
			step = 1;
		for (let i = start; i != end; i += step) {
			if (i != cur)
				bits += `<a href="page${i}" class="history">${i}</a>`;
			else
				bits += `<strong>${i}</strong>`;
		}
		bits += parseHTML
			`] [
			<a class="history" href="catalog">
				${oneeSama.lang.catalog}
			</a>
			</nav>`;
		this.resp.write(bits);
		this.pag = bits;
	}
	threadBottom() {
		let lang = this.oneeSama.lang;
		return actionLink('.', lang.return, 'bottom', 'history')
			+ '&nbsp;'
			+ actionLink('#', lang.top)
			+ `<span id="lock">${lang.locked_to_bottom}</span>`;
	}
	// <script> tags
	pageEnd() {
		let resp = this.resp;
		resp.write(this.tmpl[2]);

		// Make script loader load moderation bundle
		const ident = this.req.ident;
		if (caps.checkAuth('janitor', ident)) {
			const keys =  JSON.stringify(_.pick(ident, 'auth', 'csrf', 'email'));
			resp.write(`var IDENT = ${keys};`);
		}

		resp.write(this.tmpl[3]);
	}
}
module.exports = Render;
