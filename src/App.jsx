
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const emptyProfile = {
  slug: "",
  full_name: "",
  job_title: "",
  business_name: "WOODIFY",
  profile_photo: "",
  cover_photo: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  linkedin: "",
  is_active: true,
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [editing, setEditing] = useState(emptyProfile);
  const [password, setPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("denuwaram@gmail.com");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const path = window.location.pathname;
  const isAdminPage = path === "/admin";
  const slug = path.startsWith("/p/")
    ? path.split("/")[2]
    : "woodify-demo";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && isAdminPage) loadCustomers();
  }, [session, isAdminPage]);

  useEffect(() => {
    if (!isAdminPage) loadProfile();
  }, [slug, isAdminPage]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) setMessage(error.message);
    setProfile(data);
    setLoading(false);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setCustomers(data || []);
  }

  async function login(event) {
    event.preventDefault();
    setMessage("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) setMessage(error.message);
    else {
      setMessage("Login successful");
      setPassword("");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  function startNew() {
    setEditing({ ...emptyProfile });
    setMessage("");
  }

  function startEdit(customer) {
    setEditing({ ...customer });
    setMessage("");
  }

  function updateField(field, value) {
    setEditing((old) => ({ ...old, [field]: value }));
  }

  async function uploadPhoto(file, type) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5 MB.");
      return;
    }

    const fileExtension = file.name.split(".").pop().toLowerCase();
    const safeSlug = editing.slug.trim().toLowerCase();

    if (!safeSlug) {
      setMessage("Enter the profile URL name before uploading photos.");
      return;
    }

    const filePath = `${safeSlug}/${type}-${Date.now()}.${fileExtension}`;

    const { error } = await supabase.storage
      .from("customer-photos")
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("customer-photos")
      .getPublicUrl(filePath);

    updateField(
      type === "avatar" ? "profile_photo" : "cover_photo",
      data.publicUrl
    );

    setMessage("Image uploaded successfully.");
  }

  async function saveCustomer(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("Saving profile...");

    const record = {
      slug: editing.slug.trim().toLowerCase(),
      full_name: editing.full_name.trim(),
      job_title: editing.job_title,
      business_name: editing.business_name,
      profile_photo: editing.profile_photo,
      cover_photo: editing.cover_photo,
      phone: editing.phone,
      whatsapp: editing.whatsapp,
      email: editing.email,
      website: editing.website,
      instagram: editing.instagram,
      linkedin: editing.linkedin,
      is_active: editing.is_active,
    };

    if (!record.slug || !record.full_name) {
      setMessage("Profile URL and customer name are required.");
      setSaving(false);
      return;
    }

    let result;

    if (editing.id) {
      result = await supabase
        .from("customers")
        .update(record)
        .eq("id", editing.id);
    } else {
      result = await supabase.from("customers").insert(record);
    }

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage("Customer profile saved successfully.");
      await loadCustomers();
      setEditing({ ...emptyProfile });
    }

    setSaving(false);
  }

  async function deleteCustomer(customer) {
    const confirmed = window.confirm(
      `Delete ${customer.full_name}'s profile?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) setMessage(error.message);
    else {
      setMessage("Profile deleted.");
      loadCustomers();
      setEditing({ ...emptyProfile });
    }
  }

  function saveContact() {
    if (!profile) return;

    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile.full_name || ""}`,
      `ORG:${profile.business_name || ""}`,
      `TITLE:${profile.job_title || ""}`,
      `TEL;TYPE=CELL:${profile.phone || ""}`,
      `EMAIL:${profile.email || ""}`,
      `URL:${profile.website || ""}`,
      "END:VCARD",
    ].join("\r\n");

    const blob = new Blob([vcard], {
      type: "text/vcard;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.slug || "contact"}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const styles = `
    * { box-sizing: border-box; }
    html, body, #root {
      margin: 0; width: 100%; min-height: 100%;
      background: #090909;
    }
    body { font-family: Arial, sans-serif; }
    .page {
      width: 100%; min-height: 100vh;
      background: #090909; color: #f5f0e6;
    }
    .profile {
      width: 100%; min-height: 100vh;
      background: #11100e; overflow: hidden;
    }
    .banner {
      width: 100%; height: 38vh; min-height: 230px;
      max-height: 430px; position: relative;
      background: linear-gradient(120deg,#17130d,#72552d,#17130d);
      background-size: cover; background-position: center;
      display: flex; justify-content: center; align-items: center;
    }
    .banner-title {
      color: #f1d49b; font-size: clamp(28px,5vw,55px);
      letter-spacing: 12px; font-weight: bold;
    }
    .content {
      width: 100%; padding: 0 5vw 50px;
      text-align: center;
    }
    .avatar {
      width: 145px; height: 145px; border-radius: 50%;
      margin: -65px auto 25px; border: 4px solid #c7a45d;
      background: #242019; display: flex; justify-content: center;
      align-items: center; color: #d6b56d; font-size: 42px;
      font-weight: bold; position: relative; overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .brand {
      color: #d6b56d; letter-spacing: 8px;
      font-size: clamp(22px,3vw,30px); font-weight: bold;
    }
    .tagline {
      color: #777; font-size: 11px;
      letter-spacing: 3px; margin-top: 10px;
    }
    h1 {
      font-size: clamp(28px,4vw,42px);
      margin: 22px 0 10px; color: white;
      overflow-wrap: anywhere;
    }
    .role { color: #c9a65e; font-size: 16px; }
    .company { color: #999; font-size: 15px; margin-top: 8px; }
    .line { width: 100%; height: 1px; background: #302a1e; margin: 35px 0; }
    .actions {
      width: 100%; display: grid;
      grid-template-columns: repeat(4,minmax(0,1fr)); gap: 16px;
    }
    .action {
      display: flex; justify-content: center; align-items: center;
      min-height: 58px; padding: 15px; border-radius: 9px;
      text-decoration: none; color: #eee;
      border: 1px solid #38332a; font-size: 15px;
    }
    .action:hover { border-color: #d6b56d; background: #1c1913; }
    .primary { background: #c6a35d; color: #111; font-weight: bold; border: none; }
    .socials {
      display: flex; justify-content: center;
      gap: 16px; flex-wrap: wrap;
    }
    .socials a {
      color: #d6b56d; text-decoration: none;
      border: 1px solid #38332a; padding: 14px 25px;
      border-radius: 8px; font-size: 14px;
    }
    footer {
      color: #666; font-size: 11px;
      letter-spacing: 3px; margin-top: 45px;
    }
    .admin {
      max-width: 1000px; margin: auto; padding: 35px 20px;
    }
    .admin h1 { color: #d6b56d; }
    .panel {
      background: #15130f; border: 1px solid #38332a;
      border-radius: 12px; padding: 22px; margin: 20px 0;
    }
    .field { margin: 14px 0; text-align: left; }
    .field label { display: block; color: #c6a35d; margin-bottom: 7px; font-size: 13px; }
    .field input {
      width: 100%; padding: 12px; border-radius: 6px;
      background: #090909; border: 1px solid #49402e;
      color: white; outline: none;
    }
    .btn {
      border: 0; border-radius: 6px; padding: 12px 18px;
      background: #c6a35d; color: #111; font-weight: bold;
      cursor: pointer; margin: 5px;
    }
    .btn.secondary { background: #29251d; color: #e7d4ad; border: 1px solid #51452f; }
    .customer {
      padding: 15px; border-bottom: 1px solid #38332a;
      display: flex; justify-content: space-between;
      align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .message { color: #d6b56d; margin: 15px 0; overflow-wrap: anywhere; }
    .muted { color: #999; font-size: 13px; }
    .upload-label {
      display: inline-block; padding: 12px;
      border: 1px solid #51452f; border-radius: 6px;
      color: #d6b56d; cursor: pointer; margin: 5px;
    }
    .upload-label input { display: none; }
    .preview { max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 8px; }
    @media (min-width:601px) and (max-width:950px) {
      .actions { grid-template-columns: repeat(2,1fr); }
      .banner { height: 32vh; }
    }
    @media (max-width:600px) {
      .banner { height: 155px; min-height: 155px; }
      .banner-title { font-size: 25px; letter-spacing: 7px; }
      .content { padding: 0 20px 35px; }
      .avatar { width: 100px; height: 100px; margin-top: -45px; font-size: 30px; }
      .brand { font-size: 20px; letter-spacing: 6px; }
      .tagline { font-size: 9px; letter-spacing: 2px; }
      h1 { font-size: 25px; }
      .actions { grid-template-columns: 1fr; gap: 0; }
      .action { margin-bottom: 11px; min-height: 50px; }
      .line { margin: 25px 0; }
    }
  `;

  if (loading) {
    return <div className="page"><style>{styles}</style><div className="admin">Loading...</div></div>;
  }

  if (isAdminPage && !session) {
    return (
      <div className="page">
        <style>{styles}</style>
        <div className="admin">
          <h1>WOODIFY ADMIN</h1>
          <div className="panel">
            <h2>Admin Login</h2>
            <form onSubmit={login}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn" type="submit">Login</button>
            </form>
            <div className="message">{message}</div>
          </div>
        </div>
      </div>
    );
  }

  if (isAdminPage && session) {
    return (
      <div className="page">
        <style>{styles}</style>
        <div className="admin">
          <h1>WOODIFY ADMIN DASHBOARD</h1>
          <p className="muted">Logged in as {session.user.email}</p>
          <button className="btn secondary" onClick={logout}>Logout</button>
          <button className="btn" onClick={startNew}>+ Add Customer</button>

          <div className="panel">
            <h2>Customer Profiles</h2>
            {customers.map((customer) => (
              <div className="customer" key={customer.id}>
                <div>
                  <strong>{customer.full_name}</strong>
                  <div className="muted">/p/{customer.slug}</div>
                  <div className="muted">{customer.is_active ? "Active" : "Inactive"}</div>
                </div>
                <div>
                  <button className="btn secondary" onClick={() => startEdit(customer)}>Edit</button>
                  <button className="btn secondary" onClick={() => deleteCustomer(customer)}>Delete</button>
                  <a className="btn" href={`/p/${customer.slug}`} target="_blank" rel="noreferrer">View</a>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>{editing.id ? "Edit Customer" : "Add Customer"}</h2>
            <form onSubmit={saveCustomer}>
              {[
                ["slug", "Profile URL name (example: john)"],
                ["full_name", "Customer Name"],
                ["job_title", "Job Title"],
                ["business_name", "Business Name"],
                ["phone", "Phone Number"],
                ["whatsapp", "WhatsApp Number (country code, no +)"],
                ["email", "Email"],
                ["website", "Website URL"],
                ["instagram", "Instagram URL"],
                ["linkedin", "LinkedIn URL"],
              ].map(([field, label]) => (
                <div className="field" key={field}>
                  <label>{label}</label>
                  <input
                    value={editing[field] || ""}
                    onChange={(e) => updateField(field, e.target.value)}
                    required={field === "slug" || field === "full_name"}
                  />
                </div>
              ))}

              <div className="field">
                <label>Profile Photo</label>
                <label className="upload-label">
                  Choose Profile Photo
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => uploadPhoto(e.target.files?.[0], "avatar")} />
                </label>
                {editing.profile_photo && <img className="preview" src={editing.profile_photo} alt="Profile preview" />}
              </div>

              <div className="field">
                <label>Cover / Banner Photo</label>
                <label className="upload-label">
                  Choose Banner Photo
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => uploadPhoto(e.target.files?.[0], "banner")} />
                </label>
                {editing.cover_photo && <img className="preview" src={editing.cover_photo} alt="Banner preview" />}
              </div>

              <div className="field">
                <label>
                  <input type="checkbox" checked={!!editing.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)} />
                  {" "}Public profile active
                </label>
              </div>

              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Customer"}
              </button>
              <button className="btn secondary" type="button" onClick={startNew}>Clear Form</button>
            </form>
            <div className="message">{message}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page">
        <style>{styles}</style>
        <div className="admin">
          <h1>Profile Not Found</h1>
          <p>This WOODIFY profile does not exist or is not active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{styles}</style>
      <main className="profile">
        <div
          className="banner"
          style={profile.cover_photo ? { backgroundImage: `url(${profile.cover_photo})` } : {}}
        >
          {!profile.cover_photo && <div className="banner-title">WOODIFY</div>}
        </div>

        <div className="content">
          <div className="avatar">
            {profile.profile_photo
              ? <img src={profile.profile_photo} alt="Profile" />
              : (profile.full_name || "W").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>

          <div className="brand">WOODIFY</div>
          <div className="tagline">MADE PERSONAL. MADE TO CONNECT.</div>

          <h1>{profile.full_name}</h1>
          <div className="role">{profile.job_title}</div>
          <div className="company">{profile.business_name}</div>

          <div className="line" />

          <div className="actions">
            {profile.phone && <a className="action primary" href={`tel:${profile.phone}`}>Call Me</a>}
            {profile.whatsapp && <a className="action" href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {profile.email && <a className="action" href={`mailto:${profile.email}`}>Email</a>}
            {profile.website && <a className="action" href={profile.website} target="_blank" rel="noreferrer">Visit Website</a>}
          </div>

          <div className="line" />

          <div className="socials">
            {profile.instagram && <a href={profile.instagram} target="_blank" rel="noreferrer">Instagram</a>}
            {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
          </div>

          <div style={{ marginTop: 25 }}>
            <button className="btn" onClick={saveContact}>Save Contact</button>
          </div>

          <footer>POWERED BY WOODIFY</footer>
        </div>
      </main>
    </div>
  );
}
