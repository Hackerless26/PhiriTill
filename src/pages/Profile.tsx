import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/appContext";

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
};

export default function Profile() {
  const { user, signOut } = useApp();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name,phone,role,avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) return;
        setProfile(data);
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess("Profile updated.");
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.length) return;
    const file = event.target.files[0];
    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      setError(updateError.message);
      setUploadingAvatar(false);
      return;
    }

    setAvatarUrl(publicUrl);
    setSuccess("Avatar updated.");
    setUploadingAvatar(false);
  };

  const handlePasswordChange = async () => {
    setError(null);
    setSuccess(null);
    if (!password.trim()) {
      setError("Password cannot be empty.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setSuccess("Password updated.");
  };

  const handleLogoutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Profile</h2>
            <p className="muted">Manage your account information.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Avatar</span>
            <div className="avatar-row">
              <div className="avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile avatar" />
                ) : (
                  <span>PP</span>
                )}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                <p className="muted">
                  {uploadingAvatar ? "Uploading..." : "PNG or JPG up to 2MB."}
                </p>
              </div>
            </div>
          </label>
          <label className="field">
            <span>Email</span>
            <input type="text" value={user?.email ?? ""} readOnly />
          </label>
          <label className="field">
            <span>Role</span>
            <input type="text" value={profile?.role ?? ""} readOnly />
          </label>
          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        <div className="modal__actions">
          <button className="app__ghost" onClick={signOut}>
            Sign out
          </button>
          <button
            className="app__primary"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Change password</h2>
        <p className="muted">Use a strong password for security.</p>
        <div className="form-grid">
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>
        <button className="app__primary" onClick={handlePasswordChange}>
          Update password
        </button>
      </section>

      <section className="card">
        <h2>Security</h2>
        <p className="muted">Manage active sessions.</p>
        <div className="modal__actions">
          <button className="app__ghost" onClick={handleLogoutAll}>
            Sign out all devices
          </button>
        </div>
      </section>
    </div>
  );
}
