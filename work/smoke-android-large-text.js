import process from "node:process";
import { connectCdp } from "./android-test-utils.mjs";

const endpoint = process.env.ANDROID_CDP_URL || "http://127.0.0.1:9225";
const phase = process.env.ANDROID_LARGE_TEXT_PHASE || "baseline";
const expectedLayout = process.env.ANDROID_EXPECTED_LAYOUT || "phone";
const client = await connectCdp(endpoint);

function decodeBaseline() {
  const encoded = process.env.ANDROID_LARGE_TEXT_BASELINE;
  if (!encoded) throw new Error("The 200% text test is missing its baseline measurements.");
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

try {
  const result = await client.evaluate(`(function () {
    var navigation = Array.prototype.slice.call(
      document.querySelectorAll("[data-app-view]")
    );
    var sampleSelectors = [
      "h1",
      ".lede",
      ".serving-panel label",
      ".quick-card strong",
      ".quick-card span",
      ".app-tabs button",
      ".status-line"
    ];

    function visible(element) {
      var style = window.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    }

    function sample(selector) {
      var element = document.querySelector(selector);
      if (!element || !visible(element)) return null;
      var rect = element.getBoundingClientRect();
      return {
        selector: selector,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        fontSize: window.getComputedStyle(element).fontSize,
        lineHeight: window.getComputedStyle(element).lineHeight
      };
    }

    document.querySelector('[data-app-view="home"]').click();
    var samples = sampleSelectors.map(sample).filter(Boolean);
    var views = navigation.map(function (button) {
      button.click();
      var visibleControls = Array.prototype.slice.call(
        document.querySelectorAll("button, a.device-link, input, select, textarea, summary")
      ).filter(visible);
      var clippedText = visibleControls.filter(function (control) {
        if (!String(control.textContent || control.value || "").trim()) return false;
        return control.scrollWidth > control.clientWidth + 2
          || control.scrollHeight > control.clientHeight + 2;
      }).map(function (control) {
        return String(control.textContent || control.value || "")
          .replace(/\\s+/g, " ")
          .trim()
          .slice(0, 80);
      });
      var offscreenControls = visibleControls.filter(function (control) {
        var rect = control.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      }).map(function (control) {
        return String(control.textContent || control.value || control.tagName)
          .replace(/\\s+/g, " ")
          .trim()
          .slice(0, 80);
      });
      var buttonHeights = visibleControls
        .filter(function (control) {
          return control.matches("button, a.device-link");
        })
        .map(function (control) {
          return Math.round(control.getBoundingClientRect().height);
        });
      return {
        name: button.getAttribute("data-app-view"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        clippedText: clippedText,
        offscreenControls: offscreenControls,
        minimumActionHeight: buttonHeights.length
          ? Math.min.apply(Math, buttonHeights)
          : null
      };
    });
    document.querySelector('[data-app-view="home"]').click();

    return {
      title: document.title,
      width: window.innerWidth,
      height: window.innerHeight,
      samples: samples,
      views: views
    };
  })()`);

  if (phase === "scaled") {
    const baseline = decodeBaseline();
    if (result.width !== baseline.width) {
      throw new Error(
        `The viewport changed during the text test (${baseline.width}px to ${result.width}px).`,
      );
    }
    if (expectedLayout === "phone" && result.width >= 700) {
      throw new Error(`The 200% text phone test opened at ${result.width}px CSS width.`);
    }

    const baselineBySelector = new Map(
      baseline.samples.map((sample) => [sample.selector, sample]),
    );
    const growth = result.samples.map((sample) => {
      const before = baselineBySelector.get(sample.selector);
      return {
        selector: sample.selector,
        ratio: before ? sample.height / before.height : 0,
      };
    });
    const enlarged = growth.filter((sample) => sample.ratio >= 1.2);
    if (enlarged.length < 4) {
      throw new Error(
        "Android accepted the 200% font setting, but the WebView text did not visibly enlarge. "
        + `Measured growth: ${growth.map((item) => (
          `${item.selector}=${item.ratio.toFixed(2)}x`
        )).join(", ")}`,
      );
    }

    for (const view of result.views) {
      if (view.overflow > 1) {
        throw new Error(
          `The ${view.name} area overflows horizontally by ${view.overflow}px at 200% text.`,
        );
      }
      if (view.clippedText.length) {
        throw new Error(
          `The ${view.name} area clips text at 200%: ${view.clippedText.join(" | ")}`,
        );
      }
      if (view.offscreenControls.length) {
        throw new Error(
          `The ${view.name} area has off-screen controls at 200%: `
          + view.offscreenControls.join(" | "),
        );
      }
      if (view.minimumActionHeight !== null && view.minimumActionHeight < 40) {
        throw new Error(
          `The ${view.name} area has a ${view.minimumActionHeight}px action at 200% text.`,
        );
      }
    }
  }

  console.log(JSON.stringify({
    passed: true,
    phase,
    expectedLayout,
    ...result,
  }, null, 2));
} finally {
  client.close();
}
