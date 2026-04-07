"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Loader2, Save, Plus, Trash2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth";
import { useWorkspaceStore } from "@/features/workspace";
import { api } from "@/shared/api";
import { useFileUpload } from "@/shared/hooks/use-file-upload";
import type { Profile } from "@/shared/types";

export function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const refreshMembers = useWorkspaceStore((s) => s.refreshMembers);
  const members = useWorkspaceStore((s) => s.members);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Current workspace profile
  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentProfileId = currentMember?.profile_id;

  const fetchProfiles = useCallback(async () => {
    try {
      const list = await api.listProfiles();
      setProfiles(list);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Edit profile dialog state
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const { upload: editUpload, uploading: editUploading } = useFileUpload();

  // New profile dialog state
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.name);
    setEditEmail(p.email);
  };

  const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editProfile) return;
    e.target.value = "";
    try {
      const result = await editUpload(file);
      if (!result) return;
      const updated = await api.updateProfile(editProfile.id, { avatar_url: result.link });
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditProfile(updated);
      if (updated.is_default) {
        const me = await api.updateMe({ avatar_url: result.link });
        setUser(me);
      }
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    }
  };

  const handleEditSave = async () => {
    if (!editProfile) return;
    setEditSaving(true);
    try {
      const updated = await api.updateProfile(editProfile.id, { name: editName, email: editEmail });
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditProfile(null);
      if (updated.is_default) {
        const me = await api.updateMe({ name: editName, email: editEmail });
        setUser(me);
      }
      await refreshMembers();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (p: Profile) => {
    if (p.is_default) return;
    try {
      await api.deleteProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      await refreshMembers();
      toast.success("Profile deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete profile");
    }
  };

  const handleCreate = async () => {
    setNewSaving(true);
    try {
      const created = await api.createProfile({ name: newName, email: newEmail });
      setProfiles((prev) => [...prev, created]);
      setShowNew(false);
      setNewName("");
      setNewEmail("");
      toast.success("Profile created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create profile");
    } finally {
      setNewSaving(false);
    }
  };

  const handleSetWorkspaceProfile = async (profileId: string) => {
    if (!workspace) return;
    try {
      await api.setWorkspaceProfile(workspace.id, { profile_id: profileId });
      await refreshMembers();
      toast.success("Workspace profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set workspace profile");
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profiles section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Profiles</h2>
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
            <Plus className="h-3 w-3" />
            New Profile
          </Button>
        </div>

        <div className="grid gap-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <button
                  type="button"
                  className="h-10 w-10 shrink-0 rounded-full bg-muted overflow-hidden"
                  onClick={() => openEdit(p)}
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                      {initials(p.name)}
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {p.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Default
                      </span>
                    )}
                    {currentProfileId === p.id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        This workspace
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>

                <div className="flex items-center gap-1">
                  {currentProfileId !== p.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetWorkspaceProfile(p.id)}
                      title="Use for this workspace"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  {!p.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Profiles let you use different names, emails, and avatars per workspace.
          The default profile cannot be deleted.
        </p>
      </section>

      {/* Edit profile dialog */}
      <Dialog open={!!editProfile} onOpenChange={(o) => !o && setEditProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="group relative h-16 w-16 shrink-0 rounded-full bg-muted overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => editFileRef.current?.click()}
                disabled={editUploading}
              >
                {editProfile?.avatar_url ? (
                  <img
                    src={editProfile.avatar_url}
                    alt={editProfile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {initials(editProfile?.name ?? "")}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  {editUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </div>
              </button>
              <input
                ref={editFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditAvatarUpload}
              />
              <div className="text-xs text-muted-foreground">Click to upload avatar</div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                type="search"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={handleEditSave}
              disabled={editSaving || !editName.trim() || !editEmail.trim()}
            >
              <Save className="h-3 w-3" />
              {editSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New profile dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                type="search"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Profile name"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={newSaving || !newName.trim() || !newEmail.trim()}
            >
              {newSaving ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
