import { useUiPreferences } from "../lib/uiPreferences";

export default function Settings() {
  const { prefs, updatePrefs } = useUiPreferences();

  return (
    <div className="page">
      <section className="card">
        <h2>Settings</h2>
        <p className="muted">Update store preferences and branding.</p>
        <div className="form-grid">
          <input type="text" placeholder="Store name" />
          <input type="text" placeholder="Receipt footer message" />
          <input type="text" placeholder="Default currency (ZMW)" />
          <input type="text" placeholder="Low stock alert level" />
        </div>
        <button className="app__primary">Save settings</button>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Pick your style</h2>
            <p className="muted">Personalize layout and navigation behavior.</p>
          </div>
          <button
            className="app__ghost"
            onClick={() =>
              updatePrefs({
                theme: "light",
                layout: "vertical",
                sidebarVariant: "full",
                sidebarPosition: "left",
                headerPosition: "fixed",
              })
            }
          >
            Reset
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Theme</span>
            <select
              value={prefs.theme}
              onChange={(event) =>
                updatePrefs({ theme: event.target.value as "light" | "mist" })
              }
            >
              <option value="light">Light</option>
              <option value="mist">Mist</option>
            </select>
          </label>
          <label className="field">
            <span>Layout</span>
            <select
              value={prefs.layout}
              onChange={(event) =>
                updatePrefs({
                  layout: event.target.value as "vertical" | "horizontal",
                })
              }
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <label className="field">
            <span>Sidebar</span>
            <select
              value={prefs.sidebarVariant}
              onChange={(event) =>
                updatePrefs({
                  sidebarVariant: event.target.value as
                    | "full"
                    | "mini"
                    | "compact"
                    | "overlay"
                    | "icon-hover",
                })
              }
            >
              <option value="full">Full</option>
              <option value="mini">Mini</option>
              <option value="compact">Compact</option>
              <option value="overlay">Overlay</option>
              <option value="icon-hover">Icon hover</option>
            </select>
          </label>
          <label className="field">
            <span>Sidebar position</span>
            <select
              value={prefs.sidebarPosition}
              onChange={(event) =>
                updatePrefs({
                  sidebarPosition: event.target.value as "left" | "right",
                })
              }
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="field">
            <span>Header position</span>
            <select
              value={prefs.headerPosition}
              onChange={(event) =>
                updatePrefs({
                  headerPosition: event.target.value as "fixed" | "static",
                })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="static">Static</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
