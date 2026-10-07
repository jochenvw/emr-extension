"""Click through the guided demo + pages, collect console errors, take screenshots."""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:5180/")
OUT = os.path.join(os.path.dirname(__file__), "shots", os.environ.get("MODE", "scripted"))
MODE = os.environ.get("MODE", "scripted")
os.makedirs(OUT, exist_ok=True)

errors: list[str] = []


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))


def wait_next(page):
    page.wait_for_function("() => !document.querySelector('[data-testid=guide-next]').disabled", timeout=150_000)


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1600, "height": 960})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.add_init_script(f"localStorage.setItem('agentMode', '{MODE}')")

    page.goto(BASE + "#/story")
    page.wait_for_timeout(800)
    shot(page, "01-story")
    page.click(".choice >> nth=1")
    page.wait_for_timeout(600)
    page.mouse.wheel(0, 900)
    page.wait_for_timeout(500)
    shot(page, "02-story-choices")

    page.goto(BASE + "#/demo")
    page.wait_for_timeout(1500)
    shot(page, "10-demo-start")
    nxt = page.locator("[data-testid=guide-next]")
    for i in range(1, 11):
        wait_next(page)
        label = nxt.inner_text()
        nxt.click()
        page.wait_for_timeout(2600)
        if i == 4:  # agent step: let it finish
            wait_next(page)
            page.wait_for_timeout(1500)
        if i == 5:  # clinician edits N
            sel = page.locator("[data-testid=tnm-N]")
            if sel.count():
                sel.select_option("N2")
                page.wait_for_timeout(600)
        if i == 7:  # medication safety agent
            page.wait_for_selector("[data-testid=confirm-med]", timeout=150_000)
            page.wait_for_timeout(1200)
        headline = page.locator("[data-testid=guide-headline]").inner_text()
        print(f"step {i}: clicked '{label}' -> {headline}", flush=True)
        shot(page, f"1{i:02d}-step-{i}")

    page.click("text=Restore platform & explore")
    page.wait_for_timeout(800)
    page.click(".hx-nav >> text=Clinic worklist")
    page.click("text=Keller")
    page.wait_for_timeout(2500)
    shot(page, "130-med-after-restore")
    if page.locator("[data-testid=confirm-med]").count():
        page.click("[data-testid=confirm-med]")
        page.wait_for_timeout(1200)
        shot(page, "131-med-confirmed")
    page.click(".hx-nav >> text=Clinic worklist")
    page.click("text=Brandt")
    page.wait_for_timeout(800)
    page.click("text=Simulate: biomarker results arrive")
    page.wait_for_selector("[data-testid=confirm-trial]", timeout=150_000)
    page.wait_for_timeout(1200)
    shot(page, "140-trial")
    page.click("[data-testid=confirm-trial]")
    page.wait_for_timeout(1000)
    shot(page, "141-trial-confirmed")

    if os.environ.get("DEMO_ONLY"):
        b.close()
        print("\n".join(errors) if errors else "NO CONSOLE ERRORS")
        sys.exit(1 if errors else 0)

    page.goto(BASE + "#/architecture")
    page.wait_for_timeout(700)
    page.click("text=Trace the demo")
    page.wait_for_timeout(5000)
    shot(page, "20-arch-trace")
    page.click("[data-testid=arch-kill]")
    page.wait_for_timeout(700)
    shot(page, "21-arch-kill")
    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(500)
    shot(page, "22-arch-agent")

    page.goto(BASE + "#/plugins")
    page.wait_for_timeout(700)
    shot(page, "30-plugins")
    page.hover(".term >> text=activation")
    page.wait_for_timeout(1000)
    shot(page, "31-plugins-formula")
    page.mouse.wheel(0, 1400)
    page.wait_for_timeout(500)
    shot(page, "32-plugins-catalog")

    page.goto(BASE + "#/deck")
    for k in range(6):
        page.wait_for_timeout(700)
        shot(page, f"4{k}-slide-{k + 1}")
        page.keyboard.press("ArrowRight")
    b.close()

print("\n".join(errors) if errors else "NO CONSOLE ERRORS")
sys.exit(1 if errors else 0)
