import os
import sys
import glob
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def test_viewports():
    rendered_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'rendered_emails'))
    html_files = sorted(glob.glob(os.path.join(rendered_dir, '*.html')))
    
    if not html_files:
        print("No rendered email HTML files found!")
        return False

    viewports = [
        {"name": "Narrow Mobile (iPhone SE)", "width": 320, "height": 667, "mobile": True},
        {"name": "Standard Mobile", "width": 375, "height": 667, "mobile": True},
        {"name": "iPhone 12/13/14", "width": 390, "height": 844, "mobile": True},
        {"name": "iPhone Pro Max", "width": 430, "height": 932, "mobile": True},
        {"name": "Tablet (iPad)", "width": 768, "height": 1024, "mobile": False},
        {"name": "Desktop Monitor", "width": 1200, "height": 900, "mobile": False},
    ]

    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')

    driver = webdriver.Chrome(options=chrome_options)

    total_checks = 0
    failures = []
    results_summary = []

    try:
        for vp in viewports:
            vp_name = vp["name"]
            width = vp["width"]
            height = vp["height"]
            is_mobile = vp["mobile"]

            # Emulate viewport with CDP
            driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {
                'width': width,
                'height': height,
                'deviceScaleFactor': 1,
                'mobile': is_mobile
            })

            print(f"\n=======================================================")
            print(f"Testing Viewport: {vp_name} ({width}px x {height}px)")
            print(f"=======================================================")

            for file_path in html_files:
                filename = os.path.basename(file_path)
                file_url = f"file:///{file_path.replace(os.sep, '/')}"
                driver.get(file_url)

                # Check scrollWidth vs clientWidth
                metrics = driver.execute_script("""
                    const doc = document.documentElement;
                    const body = document.body;
                    const winWidth = window.innerWidth;
                    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
                    const clientWidth = doc.clientWidth;
                    
                    // Find any overflowing elements
                    const allElems = document.querySelectorAll('*');
                    let overflowElems = [];
                    for (let el of allElems) {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > winWidth + 1.5) { // allow tiny subpixel rounding
                            overflowElems.push({
                                tag: el.tagName,
                                class: el.className,
                                right: rect.right,
                                width: rect.width,
                                text: (el.innerText || '').slice(0, 30)
                            });
                        }
                    }

                    return {
                        winWidth: winWidth,
                        clientWidth: clientWidth,
                        scrollWidth: scrollWidth,
                        hasHorizontalScroll: scrollWidth > clientWidth + 1,
                        overflowCount: overflowElems.length,
                        sampleOverflow: overflowElems.slice(0, 2)
                    };
                """)

                total_checks += 1
                has_scroll = metrics["hasHorizontalScroll"]
                overflow_count = metrics["overflowCount"]

                if has_scroll or overflow_count > 0:
                    failures.append({
                        "viewport": f"{vp_name} ({width}px)",
                        "file": filename,
                        "metrics": metrics
                    })
                    print(f"  [FAIL] {filename:<32} | scrollWidth: {metrics['scrollWidth']}px vs clientWidth: {metrics['clientWidth']}px (overflows: {overflow_count})")
                else:
                    print(f"  [PASS] {filename:<32} | {metrics['clientWidth']}px | No horizontal scroll")

            results_summary.append({
                "viewport": vp_name,
                "width": width,
                "passed": len([f for f in html_files if not any(fail['file'] == os.path.basename(f) and fail['viewport'].startswith(vp_name) for fail in failures)]),
                "total": len(html_files)
            })

    finally:
        driver.quit()

    print("\n" + "=" * 60)
    print("RESPONSIVENESS TEST RESULTS SUMMARY")
    print("=" * 60)
    for r in results_summary:
        print(f"Viewport {r['viewport']:<28} ({r['width']}px): {r['passed']}/{r['total']} passed")

    if failures:
        print(f"\nTotal Failures: {len(failures)} out of {total_checks} checks.")
        for f in failures:
            print(f"  - {f['viewport']} | {f['file']} | scroll: {f['metrics']['scrollWidth']} > {f['metrics']['clientWidth']}")
        return False
    else:
        print(f"\nALL {total_checks} VIEWPORT CHECKS PASSED WITH 0 HORIZONTAL SCROLL OR CLIPPING!")
        return True

if __name__ == '__main__':
    success = test_viewports()
    sys.exit(0 if success else 1)
