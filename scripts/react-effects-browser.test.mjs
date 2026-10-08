import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const store = resolve(root, "node_modules/.pnpm");
const esbuildPackage = readdirSync(store).find(name => name.startsWith("esbuild@"));
const { build } = require(resolve(store, esbuildPackage, "node_modules/esbuild"));
const output = resolve(root, "tmp/react-effects-browser");
mkdirSync(output, { recursive: true });
await build({ entryPoints: [resolve(root, "scripts/fixtures/react-effects-browser.tsx")], bundle: true, outfile: resolve(output,"app.js"), jsx: "automatic", tsconfig: resolve(root,"apps/web/tsconfig.json"), loader: { ".module.css":"local-css", ".woff":"file", ".woff2":"file" }, nodePaths:[resolve(root,"apps/web/node_modules")], alias: { "next/link":resolve(root,"scripts/fixtures/content-ai-next-link.tsx"), "next/image":resolve(root,"scripts/fixtures/content-ai-next-image.tsx"), "next/navigation":resolve(root,"scripts/fixtures/react-effects-next-navigation.ts") }, define:{"process.env.NODE_ENV":'"development"', "process.env.NEXT_PUBLIC_API_URL":'"/api"'} });
let challengeCount = 0;
let otpCount = 0;
let otpClockOffset = 0;
let notesRequests = 0;
let failNotes = false;
let lastOtpExpiry = "";
let lastVerifiedCode = "";
const server=createServer(async (request,response)=>{
 const url=new URL(request.url,"http://localhost");
 const json=value=>{response.setHeader("Content-Type","application/json"); response.end(JSON.stringify(value));};
 if(url.pathname==="/api/auth/login-methods") return json({emailPasswordEnabled:true,phoneOtpEnabled:true});
 if(url.pathname==="/api/auth/security-policy") return json(["login","register","otp"].map(action=>({action,captchaEnabled:false})));
 if(url.pathname==="/api/captcha/challenge") { challengeCount++; return json({id:`challenge-${challengeCount}`,nonce:"preview",difficulty:1,expiresAt:new Date(Date.now()+60000).toISOString()}); }
 if(url.pathname==="/api/auth/otp/request") {otpCount++; lastOtpExpiry=new Date(Date.now()+otpClockOffset+300000).toISOString(); return json({challengeId:`otp-${otpCount}`,expiresAt:lastOtpExpiry});}
 if(url.pathname==="/api/auth/otp/verify") {
  let body=""; for await(const chunk of request) body+=chunk;
  lastVerifiedCode=JSON.parse(body).code;
  return json({user:{role:"buyer"}});
 }
 if(url.pathname==="/api/admin/users/00000000-0000-4000-8000-000000000001/notes") {
  notesRequests++;
  if(failNotes){response.statusCode=503; return json({message:"Unavailable"});}
  return json({items:[{id:"note-1",body:"Internal customer note",authorName:"Admin",sellerVisible:false,createdAt:"2026-10-01T00:00:00.000Z"}],nextCursor:null});
 }
 if(url.pathname==="/api/admin/stories") return json([]);
 if([".js",".css",".woff",".woff2"].includes(extname(url.pathname))) {
  response.setHeader("Content-Type",url.pathname.endsWith(".js")?"text/javascript":url.pathname.endsWith(".css")?"text/css":"font/woff2");
  return response.end(readFileSync(resolve(output,basename(url.pathname))));
 }
 response.setHeader("Content-Type","text/html; charset=utf-8");
 response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
let browser;
try {
 server.listen(0,"127.0.0.1"); await once(server,"listening");
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.setDefaultTimeout(10000);
 const errors=[]; page.on("pageerror",error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const created=[],revoked=[];
  window.previewUrls={created,revoked};
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=value=>{const url=create(value);created.push(url);return url;};
  URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
 });
 await page.goto(`${origin}/?mode=captcha`);
 await page.getByText("Browser check complete",{exact:true}).waitFor();
 assert.equal(challengeCount,1,"Strict Mode must not issue duplicate challenges");
 const first=await page.getByTestId("token").textContent();
 await page.getByRole("button",{name:"Rerender 0",exact:true}).click();
 assert.equal(challengeCount,1,"callback identity changes must not restart the challenge");
 await page.getByRole("button",{name:"Reset check",exact:true}).click();
 await page.waitForFunction(token=>document.querySelector('output')?.textContent && document.querySelector('output')?.textContent!==token,first);
 assert.equal(challengeCount,2);
 await page.goto(`${origin}/?mode=notes`);
 await page.getByText("Internal customer note",{exact:true}).waitFor();
 assert.equal(notesRequests,1,"Strict Mode must not issue duplicate initial reads");
 failNotes=true;
 await page.reload();
 await page.getByRole("alert").waitFor();
 failNotes=false;
 await page.reload();
 await page.getByText("Internal customer note",{exact:true}).waitFor();
 await page.goto(`${origin}/?mode=stories`);
 const file=page.locator('input[type="file"]');
 const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcN8AAAAASUVORK5CYII=","base64");
 await file.setInputFiles({name:"first.png",mimeType:"image/png",buffer:image});
 await page.getByRole("img",{name:"first.png",exact:true}).waitFor();
 await file.setInputFiles({name:"second.png",mimeType:"image/png",buffer:image});
 await page.getByRole("img",{name:"second.png",exact:true}).waitFor();
 await file.setInputFiles([]);
 await page.waitForFunction(()=>window.previewUrls.created.length===2&&window.previewUrls.revoked.length===2);
 await page.goto(`${origin}/?mode=login`);
 await page.getByLabel("Email, username, or mobile number",{exact:true}).fill("09123456789");
 await page.getByRole("button",{name:"Send code",exact:true}).click();
 await page.getByRole("group",{name:"SMS code",exact:true}).waitFor();
 assert.equal(otpCount,1);
 await page.getByLabel("Code digit 1",{exact:true}).fill("123456");
 await page.getByRole("button",{name:"Sign in with code",exact:true}).click();
 await page.waitForFunction(()=>document.documentElement.dataset.destination==="/en/account");
 assert.equal(lastVerifiedCode,"123456");
 const resendResponse=page.waitForResponse(response=>response.url().endsWith("/api/auth/otp/request")&&response.request().method()==="POST");
 await page.getByRole("button",{name:"Send a new code",exact:true}).click();
 await resendResponse;
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes("Expires in"));
 assert.equal(otpCount,2);
 await page.clock.install();
 await page.clock.fastForward(301000);
 otpClockOffset=301000;
 await page.getByText("This code has expired. Send a new one.",{exact:true}).waitFor();
 const freshResponse=page.waitForResponse(response=>response.url().endsWith("/api/auth/otp/request")&&response.request().method()==="POST");
 await page.getByRole("button",{name:"Send code",exact:true}).click();
 await freshResponse;
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes("Expires in"));
 assert.equal(otpCount,3,"expired challenges must request a fresh code");
 assert.equal(errors.length,0,errors.join("\n"));
 console.log("PASS: Strict Mode reads, CAPTCHA callback/reset, loading errors, preview URL cleanup, OTP verify/resend/expiry; no browser exceptions.");
} finally {await browser?.close();server.close();}
