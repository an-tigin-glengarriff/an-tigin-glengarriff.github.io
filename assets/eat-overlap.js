/* Screen-space overlap groups for the Eat map.
   Two markers intersect when the distance between their centres is less than
   the sum of their drawn radii (pixels at the current zoom). Groups are the
   connected result of that test, so a numbered dot never sits on another dot
   and the number is every place in the pile. Panning does not change these
   distances; zooming and a changed place list do. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EatOverlap = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  /* singleRadius matches a Leaflet circleMarker radius 8 with a 2px stroke
     (stroke is centred on the ring, so the outer radius is 9).
     clusterRadius matches the numbered SVG dot: r = outer - 1, stroke 2. */
  function defaults() {
    return {
      singleRadius: 9,
      clusterRadius: function (count) { return count >= 10 ? 17 : 15; }
    };
  }

  function resolveOptions(options) {
    var base = defaults();
    options = options || {};
    return {
      singleRadius: options.singleRadius == null ? base.singleRadius : options.singleRadius,
      clusterRadius: options.clusterRadius || base.clusterRadius
    };
  }

  function radiusOf(count, options) {
    if (count < 2) return options.singleRadius;
    var r = options.clusterRadius(count);
    if (!(r >= options.singleRadius)) r = options.singleRadius;
    return r;
  }

  function groupByOverlap(points, options) {
    options = resolveOptions(options);
    var groups = (points || []).map(function (p, i) {
      return { indexes: [i], x: +p.x, y: +p.y };
    });
    var guard = groups.length;
    while (guard--) {
      var best = null;
      for (var i = 0; i < groups.length; i++) {
        for (var j = i + 1; j < groups.length; j++) {
          var dx = groups[i].x - groups[j].x;
          var dy = groups[i].y - groups[j].y;
          var dist2 = dx * dx + dy * dy;
          var reach = radiusOf(groups[i].indexes.length, options) + radiusOf(groups[j].indexes.length, options);
          if (dist2 < reach * reach && (!best || dist2 < best.dist2)) best = { i: i, j: j, dist2: dist2 };
        }
      }
      if (!best) break;
      var a = groups[best.i];
      var b = groups[best.j];
      var idxs = a.indexes.concat(b.indexes);
      var sx = 0;
      var sy = 0;
      for (var k = 0; k < idxs.length; k++) {
        sx += points[idxs[k]].x;
        sy += points[idxs[k]].y;
      }
      groups.splice(best.j, 1);
      groups.splice(best.i, 1);
      groups.push({ indexes: idxs, x: sx / idxs.length, y: sy / idxs.length });
    }
    return groups.map(function (g) {
      return {
        x: g.x,
        y: g.y,
        points: g.indexes.map(function (i) { return points[i]; })
      };
    });
  }

  /* True when plotting `items` through `project` (item -> {x, y}) yields more
     than one marker, i.e. zooming to that projection would split the pile. */
  function separates(items, project, options) {
    var projected = (items || []).map(function (item) {
      var xy = project(item);
      return { x: xy.x, y: xy.y, item: item };
    });
    return groupByOverlap(projected, options).length > 1;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    var s = String(url || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return '#';
  }

  function directionsUrl(pin) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(pin.lat + ',' + pin.lng);
  }

  function linkText(pin) {
    return pin.l === 'Website' ? 'Website' : 'View on Google Maps';
  }

  function placePopupHtml(pin) {
    return '<b>' + esc(pin.n) + '</b><br><small>' + esc(pin.t) + '</small><br><span>' + esc(pin.d) + '</span><br>' +
      '<a href="' + esc(safeUrl(pin.u)) + '" target="_blank" rel="noopener">' + linkText(pin) + ' ↗</a><br>' +
      '<a href="' + esc(directionsUrl(pin)) + '" target="_blank" rel="noopener">Directions ↗</a>';
  }

  function sorted(pins) {
    return (pins || []).slice().sort(function (a, b) {
      var an = String(a.n || '');
      var bn = String(b.n || '');
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }

  function sharedTown(pins) {
    if (!pins.length) return '';
    var town = pins[0].t || '';
    for (var i = 1; i < pins.length; i++) if ((pins[i].t || '') !== town) return '';
    return town;
  }

  function placeWord(count) {
    return count === 1 ? 'place' : 'places';
  }

  function shortLabel(pins) {
    var town = sharedTown(pins);
    return (town ? town + ', ' : '') + pins.length + ' ' + placeWord(pins.length);
  }

  function ariaLabel(pins) {
    return shortLabel(pins) + ' to eat overlapping here. Show each place.';
  }

  function heading(pins) {
    var town = sharedTown(pins);
    return (town ? town + ' · ' : '') + pins.length + ' ' + placeWord(pins.length);
  }

  function placeBlock(pin) {
    return '<li class="eat-pop__place"><b>' + esc(pin.n) + '</b><small>' + esc(pin.t) + '</small><span>' + esc(pin.d) + '</span>' +
      '<span class="eat-pop__links"><a href="' + esc(safeUrl(pin.u)) + '" target="_blank" rel="noopener">' + linkText(pin) + ' ↗</a>' +
      '<a href="' + esc(directionsUrl(pin)) + '" target="_blank" rel="noopener">Directions ↗</a></span></li>';
  }

  /* `frame` is {south, west, north, east} when a closer zoom splits the group,
     otherwise null (identical or still intersecting at the closest zoom — the
     list is how you open each place). */
  function popupHtml(pins, frame) {
    var list = sorted(pins);
    var html = '<div class="eat-pop"><h4>' + esc(heading(list)) + '</h4>';
    if (!frame) html += '<p class="eat-pop__note">These stay overlapping at the closest zoom. Each place is listed here.</p>';
    html += '<ul class="eat-pop__list">' + list.map(placeBlock).join('') + '</ul>';
    if (frame && [frame.south, frame.west, frame.north, frame.east].every(isFinite)) {
      html += '<button type="button" class="eat-pop__zoom" data-south="' + frame.south + '" data-west="' + frame.west + '" data-north="' + frame.north + '" data-east="' + frame.east + '">Zoom in to separate these places</button>';
    }
    return html + '</div>';
  }

  function clusterIcon(count) {
    var outer = radiusOf(count, defaults());
    var stroke = 2;
    var r = outer - stroke / 2;
    var box = outer * 2;
    var font = count >= 10 ? 13 : 15;
    var svg = '<svg width="' + box + '" height="' + box + '" viewBox="0 0 ' + box + ' ' + box + '" aria-hidden="true">' +
      '<circle cx="' + outer + '" cy="' + outer + '" r="' + r + '" fill="#094730" stroke="#fff" stroke-width="' + stroke + '"/>' +
      '<text x="' + outer + '" y="' + outer + '" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="' + font + '" font-weight="700" font-family="Rethink Sans, Helvetica, Arial, sans-serif">' + count + '</text>' +
      '</svg>';
    return { box: box, outer: outer, html: svg };
  }

  return {
    defaults: defaults,
    groupByOverlap: groupByOverlap,
    separates: separates,
    placePopupHtml: placePopupHtml,
    popupHtml: popupHtml,
    shortLabel: shortLabel,
    ariaLabel: ariaLabel,
    clusterIcon: clusterIcon
  };
});
