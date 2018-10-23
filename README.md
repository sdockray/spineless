# spineless

This is a different way of reading PDFs. [View a demo!](https://rawgit.com/sdockray/spineless/master/index.html)

## how to use it

Include the Javascript file underneath the closing body tag.

Call _despine(parent DOM element, PDF file, display options)_

Note that you also have to include PDF.js - I'm just using the CDN but you can do whatever.

```
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@2.0.489/build/pdf.js"></script>
<script src="spineless.js"></script>
<script>
despine(document.body, 'README.pdf', { mosaic_w: 1000 });
</script>
```

If you just clone this repository and open the _index.html_ file, it will demo.

## credit

Original implementation by Robert Ochshorn, which I've adapted a few times over the years.