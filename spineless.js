(function($) {
  var pdfjsLib = window['pdfjs-dist/build/pdf'];
  var pdfjsViewer = window['pdfjs-dist/web/pdf_viewer'];

  var DEFAULTS = {
    mosaic_w: 1000,
    thumb_h: 72,
    page_h: 1000,
    box_h: 300,
    box_w: 500,
    colors: ['yellow', 'blue', 'red']
  }
  var PARAMS = {}

  $.Spineless = function($el, pdf, opts) {
    // options
    PARAMS.mosaic_w = opts.mosaic_w || DEFAULTS.mosaic_w,
    PARAMS.thumb_h = opts.thumb_h || DEFAULTS.thumb_h,
    PARAMS.page_h = opts.page_h || DEFAULTS.page_h,
    PARAMS.box_h = opts.box_h || DEFAULTS.box_h;
    PARAMS.box_w = opts.box_w || DEFAULTS.box_w;
    PARAMS.colors = opts.colors || DEFAULTS.colors;
    // 
    this.opts = opts;
    this.pdf = pdf;
    this.doc = false;
    this.pos = [0, 0];
    this.$el = $el;
    this.hls = false;
    this.initMosaic();
    this.initViewer();
    this.initNativeViewer();
    // arrays
    this.thumbs = [];
    this.pages = [];
    // initialize
    this._loadThumbs();
  }

  // This is a hidden native viewer to make use of PDF.js for searching
  $.Spineless.prototype.initNativeViewer = function () {
    var container = document.createElement("div");
    var viewer = document.createElement("div");
    this.setStyles({ display: 'hidden' }, container);
    container.appendChild(viewer);
    this.pdfViewer = new pdfjsViewer.PDFViewer({ 
       container: container,
       viewer: viewer
    });
    this.pdfFindController = new pdfjsViewer.PDFFindController({
      pdfViewer: this.pdfViewer
    });
    this.pdfViewer.setFindController(this.pdfFindController);
    this.pdfFindController.onUpdateResultsCount = this.onUpdateResultsCount.bind(this);
    this.pdfFindController.onUpdateState = this.onUpdateState.bind(this);
  }

  // make mosaic
  $.Spineless.prototype.initMosaic = function() {
    this.$mosaic = document.createElement("div");
    this.$mosaic.className = 'mosaic';
    this.setStyles({ 
      width: PARAMS.mosaic_w + 'px', 
      float: 'left', 
      zIndex: 1, 
      position: 'relative' }, 
      this.$mosaic);
    this.$el.appendChild(this.$mosaic);  
  }

  // make viewer
  $.Spineless.prototype.initViewer = function() {
    this.$viewer = document.createElement("div");
    this.$viewer.className = 'viewer';
    this.setStyles({ 
      width: PARAMS.box_w + 'px',
      height: PARAMS.box_h + 'px',
      overflow: 'auto',
      resize: 'both', 
      zIndex: 2, 
      display: 'none',
      position: 'absolute' }, 
      this.$viewer);
    this.$viewer.onscroll = this._handle_scroll.bind(this);
    this.$viewer.addEventListener('dblclick', this._handle_dblclick.bind(this), false);
    this.$viewer.onmousedown = this._handle_highlight_start.bind(this);
    this.$viewer.onmouseup = this._handle_highlight_end.bind(this);
    this.$viewer.onmousemove = this._handle_highlight_drag.bind(this);
    this.$el.appendChild(this.$viewer);
    // Also make scan box
    this.$viewerScope = document.createElement('canvas');
    this.setStyles({ 
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 5,
      pointerEvents: 'none' }, 
      this.$viewerScope);
    this.$el.appendChild(this.$viewerScope);
  }

  // make thumb
  $.Spineless.prototype.createThumb = function() {
    var $div = document.createElement('div');
    $div.className = 'blank';
    this.setStyles({ 
      position: 'relative',
      backgroundColor: 'white',
      height: PARAMS.thumb_h + 'px',
      width: 0.7 * PARAMS.thumb_h + 'px', // estimate
      display: 'inline-block' }, 
      $div);
    $div.onmousedown = this._handle_seek.bind(this);
    return $div;
  }

  // make page
  $.Spineless.prototype.createPage = function() {
    var $div = document.createElement('div');
    $div.className = 'blank';
    this.setStyles({ 
      position: 'relative',
      backgroundColor: 'white',
      height: PARAMS.page_h + 'px',
      width: PARAMS.box_w + 'px' }, // estimate 
      $div);
    return $div;
  }

  // Clear all tints
  $.Spineless.prototype.clearTints = function() {
    PARAMS.colors.forEach(c => this.clearTint(c));
  }

  // Clear all tint by color
  $.Spineless.prototype.clearTint = function(color) {
    document.querySelectorAll('.sr-' + color).forEach(function(ele){
      ele.remove();
    });
  }

  // Tint pageNum a certain color with some opacity. Color must be a word
  $.Spineless.prototype.tint = function(pageNum, ratio, color) {
    if (!isNaN(parseInt(pageNum)) && 
        isFinite(pageNum) && 
        !isNaN(parseFloat(ratio)) && 
        isFinite(ratio)) {
      var $thumb = this.thumbs[pageNum - 1];
      var isNew = true;
      if (isNew) {
        var rect = $thumb.getBoundingClientRect();
        var $div = document.createElement("div");
        $div.className = 'sr-' + color;
        this.setStyles({
          top: 0,
          left: 0,
          width: rect.width + 'px',
          height: rect.height + 'px',
          backgroundColor: color,
          position: 'absolute',
          opacity: 0.5 * ratio,
          zIndex: 10,
          pointerEvents: 'none'
        }, $div);
        $thumb.appendChild($div);
      }
    }
  }

  $.Spineless.prototype.onUpdateState = function(s) {
    // console.log('state: ', s);
  }

  $.Spineless.prototype.onUpdateResultsCount = function() {
    var query = this.pdfFindController.state.query;
    var qi = this.queries.indexOf(query);
    var total = this.pdfFindController.matchCount;
    if (total > 0 && qi >= 0) {
      var color = PARAMS.colors[qi];
      this.clearTint(color);
      var matches = this.pdfFindController.pageMatches;
      var extremes = [0, 9999];
      matches.forEach((pageMatches, i) => {
        if (pageMatches.length > extremes[0]) {
          extremes[0] = pageMatches.length;
        }
        if (pageMatches.length < extremes[1]) {
          extremes[1] = pageMatches.length;
        }
      });
      var range = extremes[0] - extremes[1];
      matches.forEach((pageMatches, i) => {
        var amount = pageMatches.length - extremes[1];
        if (amount > 0) {
          this.tint(i + 1, amount / range, color);
        }
      });
    }
    // Move on to the next query (there's no good way i can find to tell if the search is done)
    if (!Object.keys(this.pdfFindController.pendingFindMatches).length) {
      this._searchNext();
    } else {
      setTimeout(() => {
        if (this.pdfFindController.matchCount == total) {
          this._searchNext();
        }
      }, 10 * this.thumbs.length); // wait based on length of pdf
    }
  }

  // make mosaic
  $.Spineless.prototype._searchNext = function() {
    if (this.queryIndex < this.queries.length - 1 &&
        this.queryIndex < PARAMS.colors.length - 1) {
      this.queryIndex += 1;
      console.log('searching: ', this.queries[this.queryIndex]);
      this.pdfFindController.executeCommand('find', {
        caseSensitive: false, 
        findPrevious: undefined,
        highlightAll: true, 
        phraseSearch: true, 
        query: this.queries[this.queryIndex]
      });
    }
  }

  // make mosaic
  $.Spineless.prototype.search = function(query) {
    var terms = query.split(',');
    // @todo: trim terms?
    this.queryIndex = -1;
    this.queries = terms;
    this.queriesDone = [];
    this.clearTints();
    this._searchNext();
  }

  // convenience function to set styles
  $.Spineless.prototype.setStyles = function(styles, element){
    Object.assign(element.style, styles);
  }

  // draw page to fit into a variable width canvas of fixed height
  $.Spineless.prototype.makePage = function(page, height) {
    var vp = page.getViewport(1);
    var canvas = document.createElement('canvas');
    canvas.height = height;
    var scale = canvas.height / vp.height;
    canvas.width = vp.width * scale;
    return page.render({
      canvasContext: canvas.getContext("2d"), 
      viewport: page.getViewport(scale)})
    .promise.then(function () {
      return canvas;
    });
  }

  // Fits the page to the $ele height, adjusting the width based on the returned canvas
  $.Spineless.prototype.fitPage = function($ele, pageNum) {
    $ele.className = 'p';
    var h = $ele.getBoundingClientRect().height || parseFloat($ele.style.height);
    return this.doc.getPage(pageNum + 1).then(p => this.makePage(p, h))
      .then(function (canvas) {
        canvas.setAttribute('data-page', pageNum);
        $ele.style.width = canvas.width + 'px';
        $ele.appendChild(canvas);
        return canvas;
    });
  }

  // resize viewer width
  $.Spineless.prototype.resizeViewer = function(width, enlargeOnly) {
    if (enlargeOnly) {
      var currWidth = this.$viewer.getBoundingClientRect().width;
      if (width <= currWidth) {
        return false;
      }
    }
    PARAMS.box_w = width;
    this.$viewer.style.width = width + 'px';
    return true;
  }

  // Move viewer box somewhere
  $.Spineless.prototype._moveViewer = function() {
    var $thumb = this.getThumb();
    var rect = $thumb.getBoundingClientRect();
    this.setStyles({
      display: 'block',
      top: rect.top + rect.height + 'px',
      left: Math.min(window.innerWidth - PARAMS.box_w, parseInt(rect.left + this.pos[1] * rect.width)) + 'px'
    }, this.$viewer);
    return true;
  }

  // draw viewer scope box in the right place
  $.Spineless.prototype._drawViewerScope = function() {
    var $thumb = this.getThumb();
    var rect = $thumb.getBoundingClientRect();
    var h = rect.height * (PARAMS.box_h / PARAMS.page_h);
    this.setStyles({
      left: rect.left + 'px',
      top: parseInt(rect.top + this.pos[1] * rect.height) + 'px' }, 
      this.$viewerScope);
    this.$viewerScope.setAttribute("width", rect.width);
    this.$viewerScope.setAttribute("height", h);
    var ctx= this.$viewerScope.getContext("2d");
    ctx.strokeStyle = "red";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ctx.canvas.clientWidth, 0);
    ctx.stroke();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    ctx.lineTo(ctx.canvas.clientWidth, ctx.canvas.clientHeight);
    ctx.lineTo(0, ctx.canvas.clientHeight);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }

  $.Spineless.prototype.renderViewer = function() {
    if (this.doc) {
      this._drawViewerScope();
      this._moveViewer();
      this.$viewer.scrollTop = (this.pos[0] + this.pos[1]) * PARAMS.page_h;
    }
  }

  // Gets the thumb for the current position
  $.Spineless.prototype.getThumb = function() {
    return this.thumbs[this.pos[0]];
  }

  // Gets the thumb for the current position
  $.Spineless.prototype.getPage = function() {
    return this.pages[this.pos[0]];
  }

  // gets x, y position within the focus for an event
  $.Spineless.prototype._x_y = function(e) {
    return { 
      page: parseInt(e.target.getAttribute('data-page')),
      x: e.offsetX / e.target.width, 
      y: e.offsetY / e.target.height
    };
  }

  // Handle click into mosaic
  $.Spineless.prototype._handle_seek = function(e) {
    var offset = (e.offsetY - e.target.offsetTop)/e.target.clientHeight;
    var pageNum = parseInt(e.target.getAttribute('data-page'));
    // var nextPage = e.currentTarget.nextElementSibling;
    // console.log('page: ', pageNum, 'offset: ', offset);
    return this.seek(pageNum, offset);
  }

  $.Spineless.prototype._handle_scroll = function(ev) {
      var pageLoc = this.$viewer.scrollTop / PARAMS.page_h;
      var offset = pageLoc - Math.floor(pageLoc);
      var pageNum = Math.floor(pageLoc);
      return this.seek(pageNum, offset);
  }

  $.Spineless.prototype._handle_dblclick = function(ev) {
    ev.preventDefault();
    var ev2 = new CustomEvent('pointer', {
        detail: this._x_y(ev)
    });
    this.$el.dispatchEvent(ev2);
  } 

  $.Spineless.prototype._handle_highlight_start = function(ev) {
    ev.preventDefault();
    this.hls = this._x_y(ev);
    if (this.newHighlight) {
      this.newHighlight.remove();
      this.newHighlight = false;
    }
    return false;
  }

  $.Spineless.prototype._handle_highlight_drag = function(ev) {
    if (this.hls) {
      // draw a temporary highlight box
      var hle = this._x_y(ev);
      this.newHighlight = this.highlight(this.hls, hle, { active: this.newHighlight });
    }
  }


  $.Spineless.prototype._handle_highlight_end = function(ev) {
    ev.preventDefault();
    var hle = this._x_y(ev);
    if (this.hls && (
        this.hls.page != hle.page || 
        Math.abs( this.hls.x - hle.x) > .1 || // is it big enough?
        Math.abs( this.hls.y - hle.y ) > .02 
      )) {
      //this.newHighlight = this.highlight(this.hls, hle, { active: this.newHighlight });
      var ev2 = new CustomEvent('excerpt', {
        detail: {
          begin: this.hls,
          end: hle,
          ele: this.newHighlight
        }
      });
      this.$el.dispatchEvent(ev2);
    }
    this.hls = false;
    return false;
  }

  // On initial load of pdf as thumbs
  $.Spineless.prototype._loadThumbs = function() {
    var self = this;
    pdfjsLib.getDocument(this.pdf).promise.then(function (doc) {
      self.doc = doc;
      self.pdfViewer.setDocument(doc);
      // pre-create divs
      console.log('PDF loaded, pages: ', doc.numPages);
      for (var i = 0; i < doc.numPages; i++) {
        var $thumb = self.createThumb();
        self.$mosaic.appendChild($thumb);
        self.thumbs.push($thumb);

        var $page = self.createPage();
        self.$viewer.appendChild($page);
        self.pages.push($page);
      }
      // load pages as images from pdf
      return Promise.all(self.thumbs.map(function (div, num) {
        // create a div for each page and build a small canvas for it
        return self.fitPage(div, num);
      }));
      return true;
    }).catch(console.error);
  }

  // These are the methods that are of interest to the outside
  
  // Seek viewer to a particular location
  $.Spineless.prototype.seek = function(page, offset) {
    this.pos[0] = page;
    this.pos[1] = offset;
    var $page = this.getPage();
    // @todo: pre-load adjacent pages for smoother reading
    if (this.doc && $page.className == 'blank') {
      return this.fitPage($page, this.pos[0])
        .then(canvas => this.resizeViewer(canvas.width, true))
        .then(() => this.renderViewer());
    } else {
      this.renderViewer();
    }
    return true;
  }  

  // Place a pointer in a particular location on a page
  // @todo allow a callback for what to render instead of a colored square
  $.Spineless.prototype.pointer = function(pos, opts, cb) {
    var opts = opts || {};
    var $div = document.createElement('div');
    var c = opts.color || 'red';
    var $page = this.pages[pos.page];
    var rect = $page.getBoundingClientRect();
    $div.className = 'pointer';
    this.setStyles({
      position: 'absolute',
      top: pos.y * rect.height - 5 + 'px',
      left: pos.x * rect.width - 5 + 'px',
      width: 10 + 'px',
      height: 10 + 'px',
      backgroundColor: c,
    }, $div);
    $page.appendChild($div);
    $div.addEventListener('click', function(e) {
      cb(e);
    });
  }

  // points a and b should be { page, x, y }
  $.Spineless.prototype.keepHighlight = function() {
    this.newHighlight = false;
  }

  // points a and b should be { page, x, y }
  $.Spineless.prototype.highlight = function(a, b, opts) {
    var opts = opts || {};
    var canvas = opts.active || false;
    var c = opts.color || 'yellow';
    var $pageA = this.pages[a.page];
    var $pageB = this.pages[b.page];
    if (!$pageA || !$pageB) {
      return canvas;
    }
    var aRect = $pageA.getBoundingClientRect();
    var bRect = $pageB.getBoundingClientRect();
    var ay = $pageA.offsetTop + a.y * aRect.height;
    var by = $pageB.offsetTop + b.y * bRect.height;
    if (!canvas) {
      canvas = document.createElement('canvas'); 
      canvas.className = 'hl'; 
      this.setStyles({
        position: 'absolute',
        zIndex: 7,
        pointerEvents: 'none'
      }, canvas);
      this.$viewer.appendChild(canvas);
    }
    this.setStyles({
      top: Math.min(ay, by) + 'px',
      left: '0px'
    }, canvas);
    canvas.width = Math.max(aRect.width, bRect.width);
    canvas.height = Math.abs(ay - by);
    // draw the shape
    // @todo: some refinement in the shape?
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "yellow";
    ctx.globalAlpha = 0.3;
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    return canvas;
  }

})(window);


function despine($parent, pdf, opts) {
    var div = document.createElement('div');
    $parent.appendChild(div);
    var spineless = new Spineless(div, pdf, opts || {} );
    return spineless;
}
