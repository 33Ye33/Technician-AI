import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/hooks/use-api";
import type { LlmSettings } from "@/types/api";

const PROVIDER_MODELS: Record<LlmSettings["llm_provider"], string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  anthropic: "claude-opus-4-7",
};

export function AIProviderSettings() {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.llmSettings()
      .then((res) => setSettings(res.settings))
      .catch(() => setMessage("Could not load AI provider settings."));
  }, []);

  if (!settings) {
    return null;
  }

  function updateProvider(provider: LlmSettings["llm_provider"]) {
    setSettings((current) => current ? {
      ...current,
      llm_provider: provider,
      llm_model: PROVIDER_MODELS[provider],
      llm_base_url: provider === "deepseek" ? "https://api.deepseek.com" : "",
    } : current);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateLlmSettings({
        ...settings,
        llm_model: settings.llm_model.trim(),
        llm_base_url: settings.llm_base_url?.trim() || null,
      });
      setSettings(res.settings);
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="h-4 w-4 text-primary" />
            Factory AI Provider
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose which backend-configured model this factory uses. API keys stay in server environment variables.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]">
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            Provider
          </span>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={settings.llm_provider}
            onChange={(e) => updateProvider(e.target.value as LlmSettings["llm_provider"])}
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            Model
          </span>
          <Input
            value={settings.llm_model}
            onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
            placeholder="deepseek-chat"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            Base URL
          </span>
          <Input
            value={settings.llm_base_url ?? ""}
            onChange={(e) => setSettings({ ...settings, llm_base_url: e.target.value })}
            placeholder="https://api.deepseek.com"
          />
        </label>
        <div className="flex items-end">
          <Button type="button" className="w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {message && (
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      )}
    </section>
  );
}
