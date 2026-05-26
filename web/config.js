// Where the dashboard fetches plant data from.
//
// Set this to your deployed Supabase function URL, e.g.
//   https://abcdefgh.supabase.co/functions/v1/plant-report
//
// If left blank, the page will show a friendly setup error so you don't
// silently ship a non-working build.
window.PLANTWATCH_CONFIG = {
  endpoint: "",
  // If your Supabase project requires the anon key for function calls
  // (it does by default unless you set verify_jwt = false in config.toml),
  // paste the anon key here. It is a public token and safe in the browser.
  anonKey: "",
};
