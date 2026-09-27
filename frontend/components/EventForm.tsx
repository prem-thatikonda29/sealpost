"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PositionEditor } from "@/components/PositionEditor";
import { CertPreview } from "@/components/CertPreview";
import { uploadTemplate, templateUrl, type Event } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  font_size: z.coerce.number().min(8).max(300),
  font_style: z.string(),
  font_color: z.string(),
  max_text_width: z.coerce.number().min(100),
  email_subject: z.string().optional(),
  email_body: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<Event>;
  onSave: (data: Partial<Event>) => Promise<void>;
  saving?: boolean;
}

export function EventForm({ initial, onSave, saving }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      font_size: initial?.font_size ?? 48,
      font_style: initial?.font_style ?? "normal",
      font_color: initial?.font_color ?? "#000000",
      max_text_width: initial?.max_text_width ?? 1400,
      email_subject: initial?.email_subject ?? "",
      email_body: initial?.email_body ?? "Hi {name},\n\nPlease find your certificate attached.\n\nBest regards",
    },
  });

  const [templatePath, setTemplatePath] = useState(initial?.template_path ?? "");
  const [templateNW, setTemplateNW] = useState(initial?.template_natural_width ?? 0);
  const [templateNH, setTemplateNH] = useState(initial?.template_natural_height ?? 0);
  const [templateDisplayUrl, setTemplateDisplayUrl] = useState(
    initial?.template_path ? templateUrl(initial.template_path) : ""
  );
  const [fontPath, setFontPath] = useState(initial?.font_path ?? "");
  const [posX, setPosX] = useState(initial?.text_position_x ?? 0);
  const [posY, setPosY] = useState(initial?.text_position_y ?? 0);
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [draftPosX, setDraftPosX] = useState(posX);
  const [draftPosY, setDraftPosY] = useState(posY);
  const [uploading, setUploading] = useState(false);

  const formValues = watch();

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadTemplate(file);
      setTemplatePath(res.url.replace("/api/templates/", `uploads/${res.template_id}_${file.name}`));
      // Store the actual uploads/ path for backend use
      // The backend serves it at /api/templates/<id> but stores to uploads/<id>_<filename>
      setTemplatePath(`uploads/${res.template_id}_${file.name}`);
      setTemplateNW(res.natural_width);
      setTemplateNH(res.natural_height);
      setTemplateDisplayUrl(res.url);
    } finally {
      setUploading(false);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Upload font file as a "template" upload (same endpoint, different use)
    setUploading(true);
    try {
      const res = await uploadTemplate(file);
      setFontPath(`uploads/${res.template_id}_${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    await onSave({
      ...values,
      template_path: templatePath || undefined,
      template_natural_width: templateNW || undefined,
      template_natural_height: templateNH || undefined,
      font_path: fontPath || undefined,
      text_position_x: posX || undefined,
      text_position_y: posY || undefined,
    });
  };

  const previewParams = {
    template_path: templatePath,
    text_position_x: posX,
    text_position_y: posY,
    font_path: fontPath || undefined,
    font_size: formValues.font_size,
    font_style: formValues.font_style,
    font_color: formValues.font_color,
    max_text_width: formValues.max_text_width,
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Event Name *</Label>
            <Input {...register("name")} placeholder="e.g. Hackathon 2025 Winners" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="Optional notes" />
          </div>
        </CardContent>
      </Card>

      {/* Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template Image (JPG / PNG)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleTemplateUpload}
              disabled={uploading}
            />
            {templateDisplayUrl && (
              <img
                src={templateDisplayUrl}
                alt="Template preview"
                className="mt-2 rounded border max-h-40 object-contain"
              />
            )}
          </div>

          {/* Name Position */}
          <div className="space-y-1.5">
            <Label>Name Position</Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {posX > 0 && posY > 0 ? `(${posX}, ${posY})` : "Not set"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!templateDisplayUrl}
                onClick={() => {
                  setDraftPosX(posX);
                  setDraftPosY(posY);
                  setPosDialogOpen(true);
                }}
              >
                {posX > 0 ? "Edit Position" : "Set Position"}
              </Button>
            </div>
            {!templateDisplayUrl && (
              <p className="text-xs text-muted-foreground">Upload a template first</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Text Styling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Text Styling</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Font Size (px)</Label>
            <Input type="number" {...register("font_size")} min={8} max={300} />
          </div>
          <div className="space-y-1.5">
            <Label>Font Style</Label>
            <Select
              defaultValue={initial?.font_style ?? "normal"}
              onValueChange={(v) => setValue("font_style", v ?? "normal")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
                <SelectItem value="italic">Italic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Font Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                {...register("font_color")}
                className="w-10 h-9 rounded border cursor-pointer p-0.5"
              />
              <Input {...register("font_color")} className="font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Max Text Width (px)</Label>
            <Input type="number" {...register("max_text_width")} min={100} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Custom Font File (OTF / TTF) — optional</Label>
            <Input
              type="file"
              accept=".otf,.ttf"
              onChange={handleFontUpload}
              disabled={uploading}
            />
            {fontPath && (
              <p className="text-xs text-muted-foreground">
                Font loaded: {fontPath.split("/").pop()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input {...register("email_subject")} placeholder="Your Certificate — Event Name" />
          </div>
          <div className="space-y-1.5">
            <Label>
              Body{" "}
              <span className="text-muted-foreground font-normal text-xs">
                — use {"{name}"} for recipient&apos;s first name
              </span>
            </Label>
            <Textarea
              {...register("email_body")}
              rows={6}
              placeholder={"Hi {name},\n\nPlease find your certificate attached."}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving || uploading} className="w-full">
        {saving ? "Saving…" : "Save Event"}
      </Button>

      {/* Position editor dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>Set Name Position</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Click on the template to set the centre point of the name text.
              </p>
              {templateDisplayUrl && (
                <PositionEditor
                  templateUrl={templateDisplayUrl}
                  naturalWidth={templateNW}
                  naturalHeight={templateNH}
                  value={{ x: draftPosX, y: draftPosY }}
                  onChange={(x, y) => {
                    setDraftPosX(x);
                    setDraftPosY(y);
                  }}
                />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Live preview</p>
              <CertPreview
                params={{
                  ...previewParams,
                  text_position_x: draftPosX,
                  text_position_y: draftPosY,
                }}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPosDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPosX(draftPosX);
                setPosY(draftPosY);
                setPosDialogOpen(false);
              }}
            >
              Confirm Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
