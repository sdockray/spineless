(function($) {

  var DEFAULTS = {
    mosaic_w: 1000,
    thumb_h: 72,
    page_h: 1000,
    box_h: 300,
    box_w: 500
  }
  var PARAMS = {}

  $.Spineless = function($el, pdf, opts) {
    // options
    PARAMS.mosaic_w = opts.mosaic_w || DEFAULTS.mosaic_w,
    PARAMS.thumb_h = opts.thumb_h || DEFAULTS.thumb_h,
    PARAMS.page_h = opts.page_h || DEFAULTS.page_h,
    PARAMS.box_h = opts.box_h || DEFAULTS.box_h;
    PARAMS.box_w = opts.box_w || DEFAULTS.box_w;
    // 
    this.opts = opts;
    this.pdf = pdf;
    this.doc = false;
    this.$el = $el;
    this.initMosaic();
    this.initViewer();
    // arrays
    this.thumbs = [];
    this.pages = [];
    // initialize
    this.loadThumbs();
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
    this.$el.appendChild(this.$viewer);
    // Also make scan box
    this.$viewerScope = document.createElement("canvas");
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
  $.Spineless.prototype.createThumb = function(pageNum) {
    var $div = document.createElement('div');
    $div.setAttribute('data-page', pageNum + 1);
    $div.className = 'blank';
    this.setStyles({ 
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
      backgroundColor: 'white',
      height: PARAMS.page_h + 'px',
      width: PARAMS.box_w + 'px' }, // estimate 
      $div);
    return $div;
  }

  // convenience function to set styles
  $.Spineless.prototype.setStyles = function(styles, element){
    Object.assign(element.style, styles);
  }

  // draw page to fit into a variable width canvas of fixed height
  $.Spineless.prototype.makePage = function(page, height) {
    var vp = page.getViewport(1);
    var canvas = document.createElement("canvas");
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
    var h = $ele.getBoundingClientRect().height;
    return this.doc.getPage(pageNum).then(p => this.makePage(p, h))
      .then(function (canvas) {
        $ele.style.width = canvas.width + 'px';
        $ele.appendChild(canvas);
        $ele.className = 'page';
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
  $.Spineless.prototype.moveViewer = function(ele, offset) {
    var rect = ele.getBoundingClientRect();
    this.setStyles({
      display: 'block',
      top: rect.top + rect.height + 'px',
      left: Math.min(window.innerWidth - PARAMS.box_w, parseInt(rect.left + offset * rect.width)) + 'px'
    }, this.$viewer);
    return true;
  }

  // draw viewer scope box in the right place
  $.Spineless.prototype.drawViewerScope = function(ele, y) {
    var rect = ele.getBoundingClientRect();
    var h = rect.height * (PARAMS.box_h / PARAMS.page_h);
    this.setStyles({
      left: rect.left + 'px',
      top: parseInt(rect.top + y * rect.height) + 'px' }, 
      this.$viewerScope);
    this.$viewerScope.setAttribute("width", rect.width);
    this.$viewerScope.setAttribute("height", h);
    var ctx= this.$viewerScope.getContext("2d");
    // ctx.strokeStyle = "red";
    // ctx.lineWidth = 4;
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

  // Seek viewer to a particular location
  $.Spineless.prototype.seek = function(pageNum) {
    this.$viewer.scrollTop = pageNum * PARAMS.page_h;
    return true;
  }

  // Handle click into mosaic
  $.Spineless.prototype._handle_seek = function(e) {
    var offset = (e.clientY - e.target.offsetTop)/e.target.clientHeight;
    var pageNum = parseInt(e.currentTarget.getAttribute('data-page'));
    var nextPage = e.currentTarget.nextElementSibling;
    // console.log('page: ', pageNum, 'offset: ', offset);
    var $page = this.pages[pageNum - 1];
    var $thumb = this.thumbs[pageNum - 1];
    this.moveViewer($thumb, 0);
    if (this.doc && $page.className == 'blank') {
      return this.fitPage($page, pageNum)
        .then(canvas => this.resizeViewer(canvas.width, true))
        .then(() => this.seek(pageNum - 1));
    }
  }

  $.Spineless.prototype._handle_scroll = function(ev) {
      var pageLoc = this.$viewer.scrollTop / PARAMS.page_h;
      var offset = pageLoc - Math.floor(pageLoc);
      var pageNum = Math.floor(pageLoc) + 1;
      // @todo: pre-load adjacent pages for smoother reading
      var $page = this.pages[pageNum - 1];
      var $thumb = this.thumbs[pageNum - 1];
      if (this.doc && $page.className == 'blank') {
        return this.fitPage($page, pageNum)
        .then(canvas => this.resizeViewer(canvas.width, true));
      }
      // move box
      this.drawViewerScope($thumb, offset);
      this.moveViewer($thumb, offset);
  }

  // On initial load of pdf as thumbs
  $.Spineless.prototype.loadThumbs = function() {
    var self = this;
    pdfjsLib.getDocument(this.pdf).promise.then(function (doc) {
      self.doc = doc;
      // pre-create divs
      console.log('PDF loaded, pages: ', doc.numPages);
      for (var i = 0; i < doc.numPages; i++) {
        var $thumb = self.createThumb(i);
        self.$mosaic.appendChild($thumb);
        self.thumbs.push($thumb);

        var $page = self.createPage();
        self.$viewer.appendChild($page);
        self.pages.push($page);
      }
      // load pages as images from pdf
      return Promise.all(self.thumbs.map(function (div) {
        // create a div for each page and build a small canvas for it
        var num = parseInt(div.getAttribute('data-page'));
        return self.fitPage(div, num);
      }));
      return true;
    }).catch(console.error);
  }

})(window);


function despine($parent, pdf, opts) {
    var div = document.createElement('div');
    $parent.appendChild(div);
    var spineless = new Spineless(div, pdf, opts || {} );
    return spineless;
}
