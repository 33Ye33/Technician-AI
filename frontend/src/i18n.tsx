import { createContext, useContext, type ReactNode } from "react";

export type Lang = "en";

const translations = {
  en: {
    // Tabs
    tab_diagnose: "Diagnose",
    tab_quick_ask: "Quick Ask",
    tab_library: "Library",
    tab_history: "History",

    // Chat composer
    placeholder_ask: "Ask about a spec or procedure...",
    placeholder_diagnose: "Describe what you see on the line...",

    // Mobile top bar
    open_library: "Open knowledge library",
    upload_manual: "Upload knowledge",

    // Library sheet
    factory_library_title: "Factory Knowledge Library",
    factory_library_copy: "Your company's manuals, SOPs, inspection sheets, drawings, and field knowledge in one place.",
    factory_library_desc: "Upload company manuals, SOPs, repair guides, inspection sheets, drawings, spreadsheets, and field notes.",
    technician_workbench: "Technician Workbench",
    internal_knowledge: "Internal Knowledge",
    manuals_library: "Manuals Library",
    manuals_sops: "Manuals & SOPs",
    uploaded_files: "Uploaded Files",
    field_knowledge: "Field Knowledge",
    topic_buckets: "Topic Buckets",
    stat_manuals: "manuals",
    stat_files: "files",
    stat_notes: "field notes",
    stat_topics: "topics",
    no_indexed_manuals: "No indexed manuals yet.",
    no_uploaded_files: "No uploaded files yet.",
    no_field_knowledge: "No field knowledge saved yet.",
    action_ask: "Ask a Question",
    action_ask_desc: "Search specs, procedures, and prior fixes from your factory library.",
    action_diagnose: "Diagnose an Issue",
    action_diagnose_desc: "Walk through a machine problem one step at a time with safety-first guidance.",
    action_upload: "Upload Knowledge",
    action_upload_desc: "Add manuals, SOPs, repair guides, inspection sheets, drawings, and Excel files.",
    action_field: "Save Field Knowledge",
    action_field_desc: "Capture fixes from technician feedback so the next shift can search them.",

    // Chat thread status
    status_identifying: "Identifying machine",
    status_gathering: "Gathering evidence",
    status_investigating: "Investigating",
    status_safety_hold: "Safety Hold",
    status_root_cause: "Root cause",
    status_response: "Response",
    label_confirm_safe: "Confirm safe",
    label_sources: "source(s) cited",
    label_analyzing: "Analyzing...",
    label_searching: "Searching manuals...",
    label_error: "Error - please try again.",

    // Empty states
    empty_ask_title: "Ask anything",
    empty_ask_desc: "Ask about specs, procedures, or prior fixes...",
    empty_diagnose_title: "Guided diagnosis",
    empty_diagnose_desc: "Describe the problem on the line...",

    // Ask form (desktop)
    ask_instruction: "Type the issue you ran into on the line in the box below",
    ask_enter_hint: "ENTER TO SEND | SHIFT+ENTER NEW LINE",
    btn_diagnose: "Diagnose",
    btn_quick_ask: "Quick Ask",
    photo_attach: "Attach photo",
    photo_remove: "Remove photo",
    step_by_step: "Step-by-step",
    procedure_safety: "Safety first",
    procedure_tools: "Tools needed",
    procedure_steps: "Steps",
    procedure_expected: "Expected result",
    procedure_stop: "Stop and ask a supervisor",
    image_observation: "Image observation",
    image_observation_disclaimer: "This image observation is AI-generated and is not a confirmed diagnosis.",

    // History
    loading: "Loading...",
    no_history: "No history yet.",
    label_technician: "Technician",
    label_ai: "AI",
    label_feedback: "Feedback",
    label_turns: "turns",

    // Rating widget
    rating_default_diagnose: "Rate this diagnosis",
    rating_default_ask: "Rate this answer",
    rating_labels: ["Wrong", "Partially helpful", "OK", "Good", "Spot on"],
    rating_comment_placeholder: "Enter a better solution",
    rating_submit: "Submit Rating",
    rating_saving: "Saving...",
    rating_done: "Thanks for the feedback!",

    // Sidebar / drawer
    uploaded_manuals: "Uploaded Manuals",
    add_manual: "Add a Manual",
    upload_to_library: "Add to Knowledge Library",
    upload_library_desc: "Upload manuals, SOPs, repair guides, inspection sheets, drawings, and Excel files. Field notes are captured from technician feedback.",
    upload_drop_hint: "Drop a manual, SOP, repair guide, inspection sheet, drawing, or Excel file here",
    choose_file: "Choose File",
    upload_another: "Upload another",
    library: "Library",
    indexed: "indexed",
    chunks: "chunks",
    delete_manual: "Delete manual",
    delete_confirm: (name: string) => `Delete ${name} and all its chunks?`,

    // Feedback widget
    feedback_did_it_fix: "Did this fix the issue?",
    feedback_worked: "Worked",
    feedback_didnt_work: "Didn't work",
    feedback_add_note: "Add note",
    feedback_cancel: "Cancel",
    feedback_save: "Save",
    feedback_what_happened: "What actually happened on the floor?",
    feedback_what_missing: "What tip or context was missing?",
    feedback_describe: "Describe what you learned...",
    feedback_marked_worked: "Marked as worked. Thanks!",
    feedback_failed: "Failed to submit feedback.",
    field_knowledge_button: "Save as Field Knowledge",
    field_problem: "Problem / Symptom",
    field_machine: "Machine",
    field_component: "Component",
    field_tried: "What was tried",
    field_fix: "What actually fixed it",
    field_confidence: "Confidence",
    field_note: "Additional technician note",
    field_confidence_confirmed: "Confirmed",
    field_confidence_suspected: "Suspected",
    field_confidence_unsure: "Not sure",
    field_saved: "Saved field knowledge",
    field_required: "Problem/Symptom and What actually fixed it are required.",
    btn_continue: "Continue",
  },
} as const;

type Translations = (typeof translations)["en"];

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const setLang = () => undefined;

  return (
    <LangContext.Provider value={{ lang: "en", setLang, t: translations.en }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
