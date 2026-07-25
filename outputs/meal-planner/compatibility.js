(function installCompatibilityHelpers(root) {
  "use strict";

  if (!root.crypto) root.crypto = {};
  if (!root.crypto.randomUUID) {
    root.crypto.randomUUID = function randomUUID() {
      var bytes = new Uint8Array(16);
      if (root.crypto.getRandomValues) {
        root.crypto.getRandomValues(bytes);
      } else {
        for (var index = 0; index < bytes.length; index += 1) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      var hex = [];
      for (var byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
        hex.push((bytes[byteIndex] + 256).toString(16).slice(1));
      }
      return [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10).join("")
      ].join("-");
    };
  }

  if (!String.prototype.matchAll) {
    Object.defineProperty(String.prototype, "matchAll", {
      configurable: true,
      writable: true,
      value: function matchAll(expression) {
        var source = expression instanceof RegExp ? expression.source : String(expression);
        var flags = expression instanceof RegExp ? expression.flags : "";
        if (flags.indexOf("g") === -1) flags += "g";
        var matcher = new RegExp(source, flags);
        var text = String(this);
        var matches = [];
        var match;
        while ((match = matcher.exec(text)) !== null) {
          matches.push(match);
          if (match[0] === "") matcher.lastIndex += 1;
        }
        return matches;
      }
    });
  }

  if (!Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, "flatMap", {
      configurable: true,
      writable: true,
      value: function flatMap(callback, thisArg) {
        return Array.prototype.concat.apply([], this.map(callback, thisArg));
      }
    });
  }

  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value: function at(index) {
        var normalized = Math.trunc(index) || 0;
        if (normalized < 0) normalized += this.length;
        return this[normalized];
      }
    });
  }

  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, "replaceAll", {
      configurable: true,
      writable: true,
      value: function replaceAll(search, replacement) {
        if (search instanceof RegExp) {
          if (!search.global) throw new TypeError("replaceAll requires a global regular expression.");
          return this.replace(search, replacement);
        }
        return this.split(String(search)).join(replacement);
      }
    });
  }

  if (!Object.fromEntries) {
    Object.fromEntries = function fromEntries(entries) {
      return Array.from(entries).reduce(function addEntry(result, entry) {
        result[entry[0]] = entry[1];
        return result;
      }, {});
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
