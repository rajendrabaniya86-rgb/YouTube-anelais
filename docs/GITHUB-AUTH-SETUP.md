# GitHub sign-in setup

Global Trust Network uses GitHub OAuth through Supabase Auth. The same callback route is used for web and Android OAuth:

`com.rajendra.globaltrustnetwork://login-callback`

## One-time GitHub and Supabase configuration

1. Open GitHub Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set the application name to Global Trust Network.
3. Set Homepage URL to the deployed web app's HTTPS origin.
4. Set Authorization callback URL to the Supabase Auth callback shown in the Supabase project. For the current test project use:
   `https://wlohqkgegsknygdxufie.supabase.co/auth/v1/callback`
5. Create the OAuth App and copy its Client ID and generate a Client Secret.
6. In Supabase Dashboard → Authentication → Sign In / Providers → GitHub, enable GitHub and enter the Client ID and Client Secret. Keep the secret in Supabase only. Never place it in frontend code, Vite variables, GitHub repository files, or the APK.
7. In Supabase Dashboard → Authentication → URL Configuration, add this exact Additional Redirect URL:
   `com.rajendra.globaltrustnetwork://login-callback`
   Also ensure the deployed web app origin is in the allowed redirect URLs.
8. Save and confirm the GitHub provider is enabled.

## App behavior

- GitHub is an additional OAuth option. Email/password, email confirmation/resend, Google OAuth, and WhatsApp phone OTP UI remain present.
- GitHub sign-in uses Supabase Auth's `signInWithOAuth({ provider: 'github' })`.
- In signup mode, the user first chooses Customer or Shop Owner and enters the requested profile fields. The existing server-side `ensure-google-account` provisioning function is reused after OAuth to create/update the profile and shop. Its service-role credential stays server-side.
- In login mode, the GitHub identity must already be associated with the account. OAuth providers do not automatically merge separate email and GitHub identities. Do not assume a GitHub account with the same email is linked to an existing email/password account.
- GitHub OAuth can fail if the GitHub email is private and Supabase cannot obtain a usable email. Set a verified primary email on GitHub and grant the requested `read:user user:email` scopes.
- The app's callback URL must be allowed in Supabase. Android deep-link intent filter is injected by the existing APK workflow.

## Test sequence

1. Configure GitHub OAuth App and Supabase GitHub provider.
2. In a test environment, create a new Shop Owner using GitHub; verify exactly one shop is created with the entered shop name.
3. Log out and sign in with the same GitHub account; verify the same shop opens.
4. Create a Customer with GitHub; verify the customer portal opens and no shop is created.
5. Confirm email/password, email verification, Google, and WhatsApp OTP options remain visible and unchanged.
