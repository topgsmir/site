import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoginForm } from "../../apps/web/src/app/[locale]/login/LoginForm";
import { CaptchaWidget } from "../../apps/web/src/components/CaptchaWidget";
import { AdminUserNotes } from "../../apps/web/src/components/admin/AdminUserNotes";
import { HomepageStoriesWorkspace } from "../../apps/web/src/components/admin/HomepageStoriesWorkspace";
import { getDictionary } from "../../apps/web/src/lib/i18n";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/outfit";
import "../../apps/web/src/app/globals.css";
function CaptchaPreview() {
  const [token, setToken] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [reset, setReset] = useState(0);
  return <><button type="button" onClick={() => setRevision(n => n + 1)}>Rerender {revision}</button><button type="button" onClick={() => setReset(n => n + 1)}>Reset check</button><output data-testid="token">{token}</output><CaptchaWidget action="login" resetSignal={reset} onTokenChange={value => setToken(value)} /></>;
}
const mode = new URLSearchParams(location.search).get("mode");
createRoot(document.getElementById("root")!).render(<StrictMode>{mode === "captcha" ? <CaptchaPreview /> : mode === "notes" ? <AdminUserNotes userId="00000000-0000-4000-8000-000000000001" locale="en" /> : mode === "stories" ? <HomepageStoriesWorkspace locale="en" /> : <LoginForm locale="en" copy={getDictionary("en").auth} />}</StrictMode>);
