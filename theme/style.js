/*!
 * eXeTexto — eXeLearning style script
 * Turns the resource into a teletext service: numbered pages that can be typed,
 * a header row with the page, date and clock, a numbered index and the four
 * coloured keys (previous, index, activities and next).
 * Dedicated to the public domain under CC0 1.0.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    // Before the first paint, so the screen never flashes as a plain page.
    root.classList.add('tt-js');

    var LABELS = {
        es: { index: 'Índice', activities: 'Actividades', keys: 'Teclas de colores' },
        ca: { index: 'Índex', activities: 'Activitats', keys: 'Tecles de colors' },
        gl: { index: 'Índice', activities: 'Actividades', keys: 'Teclas de cores' },
        eu: { index: 'Aurkibidea', activities: 'Jarduerak', keys: 'Kolore-teklak' },
        en: { index: 'Index', activities: 'Activities', keys: 'Colour keys' },
    };
    // The yellow key prefers a page called "Activities"; otherwise the next page with one.
    var ACTIVITIES_TITLE = /actividad|activitat|activit|jarduer|atividade/i;
    var CONTROLS = 'input, textarea, select, button, [contenteditable], .idevice_node:not(.text)';
    var SERVICE = 'eXeTEXTO';

    var lang = (root.lang || 'es').slice(0, 2);
    var pages = [];
    var current = null;
    var parts = {};
    var typed = '';
    var typingTimer = null;
    var narrow = window.matchMedia('(max-width: 59.99rem)');

    function label(key, fallback) {
        if (window.$exe_i18n && window.$exe_i18n[key]) return window.$exe_i18n[key];
        return (LABELS[lang] || LABELS.en)[key] || fallback;
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function stripUrl(url) {
        var parsed = new URL(url, location.href);
        parsed.hash = '';
        parsed.search = '';
        return parsed.href;
    }

    /* ---------- Page numbers ---------- */

    /*
     * Teletext numbering: top-level pages 100, 200…; their children 210, 220…; and the
     * grandchildren 211, 212… When the tree does not fit (more than 8 top-level pages,
     * 9 children or 3 levels), the pages are numbered 100, 101, 102… in reading order.
     */
    function numberPages(nav) {
        var list = [];
        var fits = true;
        var STEPS = [100, 10, 1];
        (function walk(ul, base, depth) {
            if (!ul) return;
            var items = ul.children;
            for (var i = 0; i < items.length; i++) {
                if (depth > 2 || i >= (depth ? 9 : 8)) fits = false;
                var number = base + (STEPS[depth] || 0) * (i + 1);
                var link = items[i].querySelector(':scope > a[href]');
                if (link) list.push({ link: link, number: number, title: link.textContent.trim() });
                walk(items[i].querySelector(':scope > ul'), number, depth + 1);
            }
        })(nav.querySelector(':scope > ul'), 0, 0);
        list.forEach(function (page, i) {
            page.index = i;
            if (!fits) page.number = 100 + i;
        });
        return list;
    }

    function pageByNumber(number) {
        for (var i = 0; i < pages.length; i++) if (pages[i].number === number) return pages[i];
        return null;
    }

    // Pages with an activity, from the search index: games keep a typeGame, quizzes their questions.
    function hasActivities(page) {
        var data = window.exeSearchData;
        if (!data || !pages.length) return false;
        var base = new URL('.', new URL(pages[0].link.href));
        for (var id in data) {
            if (stripUrl(new URL(data[id].fileUrl, base)) !== stripUrl(page.link.href)) continue;
            return /typeGame|questionsData/.test(JSON.stringify(data[id].blocks || {}));
        }
        return false;
    }

    function activitiesPage() {
        var titled = pages.filter(function (page) {
            return ACTIVITIES_TITLE.test(page.title);
        });
        var withActivities = pages.filter(hasActivities);
        var after = withActivities.filter(function (page) {
            return current && page.index > current.index;
        });
        var candidates = titled.concat(after, withActivities);
        for (var i = 0; i < candidates.length; i++) if (candidates[i] !== current) return candidates[i];
        return null;
    }

    /* ---------- Header row: page entry, service, date and clock ---------- */

    function pad(number) {
        return String(number).padStart(2, '0');
    }

    function showEntry(missing) {
        parts.entry.textContent = 'P' + (typed ? typed.padEnd(3, '-') : current ? current.number : '100');
        parts.entry.classList.toggle('tt-entry-typing', !!typed);
        parts.entry.classList.toggle('tt-entry-missing', !!missing);
    }

    function tick() {
        var now = new Date();
        var date = now.toLocaleDateString(root.lang || undefined, { weekday: 'short', day: '2-digit', month: 'short' });
        parts.date.textContent = date.replace(/[.,]/g, '');
        parts.clock.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + '/' + pad(now.getSeconds());
    }

    function buildStatus(screen) {
        var status = element('div', 'tt-status');
        status.setAttribute('aria-hidden', 'true');
        parts.entry = element('span', 'tt-entry');
        parts.date = element('span', 'tt-date');
        parts.clock = element('span', 'tt-clock');
        status.append(parts.entry, element('span', 'tt-service', SERVICE), element('span', 'tt-status-number', current ? String(current.number) : ''), parts.date, parts.clock);
        screen.prepend(status);
        showEntry();
        tick();
        setInterval(tick, 1000);
    }

    // Typing three digits goes to that page, as with a teletext remote control.
    function type(digit) {
        if (typed.length >= 3) typed = '';
        typed += digit;
        clearTimeout(typingTimer);
        if (typed.length < 3) {
            showEntry();
            typingTimer = setTimeout(clearEntry, 4000);
            return;
        }
        var page = pageByNumber(parseInt(typed, 10));
        if (page && page !== current) {
            showEntry();
            location.href = page.link.href;
            return;
        }
        showEntry(!page);
        typingTimer = setTimeout(clearEntry, 1500);
    }

    function clearEntry() {
        typed = '';
        showEntry();
    }

    /* ---------- Banner, index and side column ---------- */

    function buildBanner(screen, main) {
        var banner = element('div', 'tt-banner');
        var title = element('div', 'tt-banner-title');
        var packageHeader = main.querySelector('.package-header');
        if (packageHeader) title.append(packageHeader);
        var number = element('div', 'tt-banner-page');
        number.append(element('span', 'tt-banner-number', current ? String(current.number) : ''));
        number.firstChild.setAttribute('aria-hidden', 'true');
        var counter = main.querySelector('.page-counter');
        if (counter) {
            var strong = counter.querySelectorAll('strong');
            for (var i = 0; i < strong.length; i++) strong[i].textContent = pad(strong[i].textContent.trim());
            number.append(counter);
        }
        banner.append(title, number);
        parts.status.after(banner);

        var pageTitle = main.querySelector('.page-title');
        if (pageTitle && current) pageTitle.prepend(element('span', 'tt-page-number', current.number + ' '));
    }

    function setIndex(open, focusBack) {
        document.body.classList.toggle('tt-index-open', open);
        parts.green.setAttribute('aria-expanded', open ? 'true' : 'false');
        parts.index.inert = narrow.matches && !open;
        if (open) {
            var target = parts.index.querySelector('#siteNav a.active') || parts.index.querySelector('a, input');
            if (target) target.focus();
        } else if (focusBack) {
            parts.green.focus();
        }
    }

    function buildIndex(main, nav) {
        var index = element('div', 'tt-index');
        index.id = 'tt-index';
        index.append(element('p', 'tt-index-title', label('index', 'Index')), nav);
        pages.forEach(function (page) {
            page.link.prepend(element('span', 'tt-number', String(page.number)));
        });
        var search = document.getElementById('exe-client-search-form');
        if (search) {
            index.append(search);
            search.addEventListener('submit', function () {
                if (narrow.matches) setIndex(false);
            });
        }
        // Before the page, as eXeLearning puts the menu: the index comes first when tabbing.
        main.before(index);
        parts.index = index;
    }

    // Boxes marked tt-side go to a column beside the content on wide screens.
    function buildSide(main) {
        var boxes = main.querySelectorAll('.page-content > .box.tt-side');
        if (!boxes.length) return;
        var aside = element('aside', 'tt-aside');
        for (var i = 0; i < boxes.length; i++) aside.append(boxes[i]);
        main.querySelector('.page-content').after(aside);
        main.classList.add('tt-has-aside');
    }

    /* ---------- Coloured keys ---------- */

    function key(node, colour) {
        node.classList.add('tt-key', 'tt-key-' + colour);
        return node;
    }

    function disabledKey(colour, text) {
        var node = key(element('span', '', ''), colour);
        node.append(element('span', 'tt-key-label', text));
        node.setAttribute('aria-disabled', 'true');
        return node;
    }

    function buildKeys(screen) {
        var bar = element('nav', 'tt-keys');
        bar.setAttribute('aria-label', label('keys', 'Colour keys'));
        var buttons = document.querySelector('.nav-buttons');
        var previous = buttons && buttons.querySelector('.nav-button-left');
        var next = buttons && buttons.querySelector('.nav-button-right');

        parts.red = previous && previous.href ? key(previous, 'red') : disabledKey('red', label('previous', 'Previous'));
        parts.blue = next && next.href ? key(next, 'blue') : disabledKey('blue', label('next', 'Next'));
        [parts.red, parts.blue].forEach(function (node) {
            var text = node.querySelector('span');
            if (text) text.classList.add('tt-key-label');
        });

        parts.green = key(element('button', ''), 'green');
        parts.green.type = 'button';
        parts.green.append(element('span', 'tt-key-label', label('index', 'Index')));
        parts.green.setAttribute('aria-controls', 'tt-index');
        parts.green.setAttribute('aria-expanded', 'false');
        parts.green.addEventListener('click', function () {
            if (narrow.matches) {
                setIndex(!document.body.classList.contains('tt-index-open'));
                return;
            }
            var target = parts.index.querySelector('#siteNav a.active') || parts.index.querySelector('a');
            if (target) target.focus();
        });

        var target = activitiesPage();
        if (target) {
            parts.yellow = key(element('a', ''), 'yellow');
            parts.yellow.href = target.link.href;
            parts.yellow.append(element('span', 'tt-key-label', label('activities', 'Activities')));
            parts.yellow.title = target.number + ' ' + target.title;
        } else {
            parts.yellow = disabledKey('yellow', label('activities', 'Activities'));
        }

        bar.append(parts.red, parts.green, parts.yellow, parts.blue);
        screen.append(bar);
        if (buttons) buttons.remove();
    }

    function buildFooter(screen) {
        var footer = element('div', 'tt-footer');
        var license = document.getElementById('siteFooter');
        var made = document.getElementById('made-with-eXe');
        if (license) footer.append(license);
        if (made) footer.append(made);
        screen.append(footer);
    }

    /* ---------- Keyboard ---------- */

    function listen() {
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && document.body.classList.contains('tt-index-open')) {
                setIndex(false, true);
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
            if (event.target.closest && event.target.closest(CONTROLS)) return;
            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                type(event.key);
                return;
            }
            if (event.key === 'Backspace' && typed) {
                event.preventDefault();
                typed = typed.slice(0, -1);
                showEntry();
                return;
            }
            var link = { ArrowLeft: parts.red, ArrowRight: parts.blue }[event.key];
            if (!link || !link.href) return;
            event.preventDefault();
            location.href = link.href;
        });
        document.addEventListener('click', function (event) {
            if (!document.body.classList.contains('tt-index-open')) return;
            if (parts.index.contains(event.target) || parts.green.contains(event.target)) return;
            setIndex(false);
        });
        narrow.addEventListener('change', function () {
            setIndex(false);
        });
    }

    function init() {
        var body = document.body;
        var screen = document.querySelector('.exe-web-site .exe-content');
        var main = screen && screen.querySelector('main.page');
        var nav = document.getElementById('siteNav');
        if (!main || !nav || document.querySelector('.tt-status')) {
            root.classList.remove('tt-js');
            return;
        }
        pages = numberPages(nav);
        var active = nav.querySelector('a.active');
        current = pages.filter(function (page) {
            return page.link === active;
        })[0] || null;

        buildStatus(screen);
        parts.status = screen.querySelector('.tt-status');
        buildBanner(screen, main);
        buildIndex(main, nav);
        buildSide(main);
        buildKeys(screen);
        buildFooter(screen);
        setIndex(false);
        listen();
        body.classList.add('tt-ready');
    }

    // After eXeLearning's own ready handlers, which build the search form.
    if (window.jQuery) window.jQuery(init);
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
