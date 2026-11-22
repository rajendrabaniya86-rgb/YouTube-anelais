# Google sign-in setup

Google sign-in uses Supabase Auth OAuth. The Android app opens the OAuth flow in the system browser and returns through the registered app link:

`com.rajendra.globaltrustnetwork://login-callback`

## One-time Google and Supabase configuration

1. In Google Cloud, create an OAuth 2.0 Client ID with application type **Web application**.
2. In that OAuth client, add the deployed web app origin to **Authorized JavaScript origins**. Do not add a path to the origin.
3. In **Authorized redirect URIs**, add the Supabase callback shown on the Supabase Dashboard under Authentication → Providers → Google. For the current test project it is:
   `https://wlohqkgegsknygdxufie.supabase.co/auth/v1/callback`
4. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and save the Web Client ID and Client Secret. Keep the client secret in Supabase only. Never put it in Vite variables, source code, or the APK.
5. In Supabase Dashboard → Authentication → URL Configuration, add this exact Additional Redirect URL:
   `com.rajendra.globaltrustnetwork://login-callback`
6. Save and confirm the Google provider is enabled.

For a Google signup, the user chooses Shop Owner or Customer first. Shop Owners must enter a shop name. After Google confirms the identity, the authenticated `ensure-google-account` Edge Function creates or updates the profile and creates/updates only that user's shop. Customer accounts do not get a shop. The function verifies the caller's access token and keeps the service-role key server-side.

## Deployment status

- The `ensure-google-account` Edge Function is deployed to the dedicated test project `wlohqkgegsknygdxufie` with JWT verification enabled.
- Android OAuth deep-link registration is injected into the generated Capacitor AndroidManifest during the APK workflow.
- Google OAuth cannot complete until the Google Web Client ID/Secret and Supabase provider/redirect settings above are configured.
- The Android debug signing certificate is not the eventual Play Store signing certificate. If switching to native Credential Manager sign-in later, register the correct Android package and signing SHA-1 fingerprints separately.

## Test sequence

Use synthetic accounts only:
1. Create a new Shop Owner with Google and verify exactly one shop is created with the submitted shop name.
2. Log out and use Google login with the same account; verify the same shop opens.
3. Create a Customer account with Google; verify the customer portal opens and no shop is created.
4. Switch between two shop-owner accounts and confirm that each sees only its own shop and records.
