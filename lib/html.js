'use strict';

var highlightText = require('./text.js');
var mergeDefaultOptions = require('./options.js');

var inlineElements = ["b", "big", "i", "small", "tt,", "abbr", "acronym", "cite", "code", "dfn", "em", "kbd", "strong", "samp", "var,", "a", "bdo", "br", "img", "map", "object", "q", "script", "span", "sub", "sup,", "button", "input", "label", "select", "textarea,"];

module.exports = function highlightHtml(html, query, options) {

  options = mergeDefaultOptions(options);

  // Generate HTML mapping
  // This array contains the list of mappings from the text representation to the HTML.
  var mappings = [];

  // Let's build the raw text representation, and keep track of the match between text-index and html-index.
  var text = '';
  var i = 0;
  while(true) {
    var startIndex = html.indexOf('<', i);
    if(startIndex === -1) {
      text += html.substr(i);
      break;
    }

    // We got a new markup element
    var endIndex = html.indexOf('>', startIndex);
    if(endIndex === -1) {
      throw new Error("Invalid HTML markup.");
    }

    // Add content to text, until element starts
    text += html.substr(i, startIndex - i);

    var isClosingElement = (html[startIndex + 1] === '/');

    if(isClosingElement) {
      var markupElement = html.substr(startIndex + 2, endIndex - startIndex - 2);
      if(inlineElements.indexOf(markupElement) === -1) {
        // End of block element, add a line separator.
        // This avoids generating Something</div><div>Lol to "SomethingLol".
        text += " ";
        startIndex += 1;
        endIndex += 1;
      }
    }
    // t: index in text
    // h: index in HTML
    // l: length of skipped HTML
    // c: is a closing item
    mappings.push({t: text.length, h: endIndex, l: endIndex - startIndex + 1, c: isClosingElement});
    i = endIndex + 1;
  }

  // Highlight raw text
  var highlightedText = highlightText(text, query, options);


  /**
   * Maps text indexes to html indexes, according to our mapping
   */
  var getMapping = function(textStartIndex, textEndIndex) {
    var ret = [];

    var htmlStartDelta = 0;
    var htmlEndDelta = 0;

    for(var i = 0; i < mappings.length; i += 1) {
      var mapping = mappings[i];

      // Stop end-mapping when going after endindex
      if(textEndIndex <= mapping.t) {
        break;
      }

      // Stop start-mapping when going after startindex
      if(mapping.t < textStartIndex) {
        htmlStartDelta += mapping.l;
      }
      else {
        // We have an element defined after the start of our highlight and before the end (e.g. <span>something *our </span> highlight*), we need to generate multiple indices (<span>something *our* </span> *highlight*)

        if(!mapping.c && mappings[i + 1] && mappings[i + 1].c && textEndIndex >= mappings[i + 1].t) {
          // Special case: the element is totally included in our highlight, so we can continue like nothing happened.
         // E.G. *Eat <strong>drink</strong> and be merry*
          i += 1;
          htmlEndDelta += mapping.l;
          mapping = mappings[i];
        }
        else {
          // Create a new mapping unless it would be empty
          if(textStartIndex + htmlStartDelta !== mapping.h - mapping.l + 1) {
            ret.push({
              start: textStartIndex + htmlStartDelta,
              end: mapping.h - mapping.l + 1
            });
          }

          // Update new startDelta
          htmlStartDelta = mapping.h - textStartIndex + 1;
        }
      }

      htmlEndDelta += mapping.l;
    }

    ret.push({
      start: textStartIndex + htmlStartDelta,
      end: textEndIndex + htmlEndDelta
    });

    return ret;
  };

  // Rebuild highlight in HTML, using index informations
  var globalIndexDelta = 0; // Store a "global delta", which is the length of all our options.before and options.after we added to the text (they affect the mapping).
  highlightedText.indexes.forEach(function(index) {
    // Map text-index to HTML-index
    var htmlIndices = getMapping(index.startIndex, index.endIndex);

    for(var i = 0; i < htmlIndices.length; i +=1) {
      var htmlIndex = htmlIndices[i];
      // Add indexes from previous highlights
      htmlIndex.start += globalIndexDelta;
      htmlIndex.end += globalIndexDelta;

      var before = html.substr(0, htmlIndex.start);
      var content = html.substr(htmlIndex.start, htmlIndex.end - htmlIndex.start);
      var after = html.substr(htmlIndex.end);


      // Update HTML with mapping
      var highlightBefore = i === 0 ? options.before:options.beforeSecond;
      html = before + highlightBefore + content + options.after + after;
      globalIndexDelta += highlightBefore.length + options.after.length;
    }
  });
  
  return {html: html, text: highlightedText.text};
};
