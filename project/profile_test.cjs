const { createClient } = require('@supabase/supabase-js');

const db = {
  url: "https://evzlqrekovjimofgddwj.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2emxxcmVrb3ZqaW1vZmdkZHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjMyNTksImV4cCI6MjA5NzQzOTI1OX0.dibnBJJe1RtuKZsMrL6A7SlKl3e9gv4fFCkDuAJXhW8"
};

const supabase = createClient(db.url, db.anon);

async function run() {
  const email = "e2e_test_1781951517887@gmail.com"; // the email from the successful node signup test
  const password = "Password123!";
  
  console.log(`Signing in as ${email}...`);
  const signInRes = await supabase.auth.signInWithPassword({ email, password });
  if (signInRes.error) {
    console.error("Sign in error:", signInRes.error);
    return;
  }
  
  const user = signInRes.data.user;
  console.log("Sign in successful. User ID:", user.id);
  
  console.log("Fetching profile...");
  const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profileRes.error) {
    console.error("Profile fetch error:", profileRes.error);
  } else {
    console.log("Profile details:", profileRes.data);
  }
}

run();
