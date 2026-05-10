// Component-tree renderer. Walks the A2UI v0.8 component graph and emits
// shadcn/ui primitives styled via the charcoal-workshop @theme palette.
// The shadcn components consume Tailwind utility tokens (bg-primary,
// text-foreground, etc.) which resolve to the --color-* CSS vars in
// index.css; theming is centralized there, not per-component.

import { useMemo } from 'react';
import type { ComponentNode, StringRef } from './schema';
import type { DataModel, SurfaceState } from './store';
import { store } from './store';
import { dispatchAction } from './bridge';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const resolveString = (ref: StringRef | undefined, data: DataModel): string => {
  if (!ref) return '';
  if ('literalString' in ref) return ref.literalString;
  const key = ref.path.replace(/^\//, '');
  const v = data[key];
  return v == null ? '' : String(v);
};

const resolveNumber = (ref: { path: string }, data: DataModel): number => {
  const key = ref.path.replace(/^\//, '');
  const v = data[key];
  return typeof v === 'number' ? v : Number(v) || 0;
};

type Ctx = { surfaceId: string; nodes: Map<string, ComponentNode>; data: DataModel };

const renderById = (id: string, ctx: Ctx): React.ReactNode => {
  const node = ctx.nodes.get(id);
  if (!node) return <span className="text-destructive">missing: {id}</span>;
  return <RenderNode node={node} ctx={ctx} />;
};

const RenderNode = ({ node, ctx }: { node: ComponentNode; ctx: Ctx }) => {
  const c = node.component;

  if ('Column' in c) {
    const ids = 'explicitList' in c.Column.children ? c.Column.children.explicitList : [];
    return <div className="flex flex-col gap-3">{ids.map((id) => <div key={id}>{renderById(id, ctx)}</div>)}</div>;
  }

  if ('Row' in c) {
    const ids = 'explicitList' in c.Row.children ? c.Row.children.explicitList : [];
    return <div className="flex flex-row items-center gap-3">{ids.map((id) => <div key={id}>{renderById(id, ctx)}</div>)}</div>;
  }

  if ('Card' in c) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">{renderById(c.Card.child, ctx)}</CardContent>
      </Card>
    );
  }

  if ('Text' in c) {
    const text = resolveString(c.Text.text, ctx.data);
    const hint = c.Text.usageHint;
    // Text colors are inherited from parent so wrappers like Button's
    // text-primary-foreground on a primary variant cascade correctly.
    if (hint === 'h1') return <h1 className="text-xl font-semibold tracking-tight">{text}</h1>;
    if (hint === 'h2') return <h2 className="text-lg font-semibold tracking-tight">{text}</h2>;
    if (hint === 'h3') return <h3 className="text-base font-semibold">{text}</h3>;
    if (hint === 'caption') return <p className="text-muted-foreground text-xs italic">{text}</p>;
    return <p className="leading-relaxed">{renderInlineMarkdown(text)}</p>;
  }

  if ('Button' in c) {
    return (
      <Button
        size="sm"
        variant={c.Button.primary ? 'default' : 'secondary'}
        onClick={() => {
          if (c.Button.action) dispatchAction(ctx.surfaceId, node.id, c.Button.action, ctx.data);
        }}
      >
        <span className="uppercase tracking-wider text-xs">{renderById(c.Button.child, ctx)}</span>
      </Button>
    );
  }

  if ('TextField' in c) {
    const label = resolveString(c.TextField.label, ctx.data);
    const key = c.TextField.text.path.replace(/^\//, '');
    const value = ctx.data[key];
    const valueStr = value == null ? '' : String(value);
    const inputId = `tf-${ctx.surfaceId}-${node.id}`;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <Label htmlFor={inputId} className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>}
        <Input
          id={inputId}
          value={valueStr}
          onChange={(e) => store.setDataValue(ctx.surfaceId, key, e.target.value)}
          className="font-mono"
        />
      </div>
    );
  }

  if ('Slider' in c) {
    const label = resolveString(c.Slider.label, ctx.data);
    const key = c.Slider.value.path.replace(/^\//, '');
    const value = resolveNumber(c.Slider.value, ctx.data);
    const min = c.Slider.minValue ?? 0;
    const max = c.Slider.maxValue ?? 100;
    return (
      <div className="flex flex-col gap-2">
        {label && <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>}
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={1}
          onValueChange={(v) => store.setDataValue(ctx.surfaceId, key, v[0])}
        />
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
    );
  }

  if ('MultipleChoice' in c) {
    const mc = c.MultipleChoice;
    const label = resolveString(mc.label, ctx.data);
    const isMulti = (mc.maxAllowedSelections ?? 1) !== 1 || mc.type === 'checkbox';
    let key = '';
    let current: string[] = [];
    if ('path' in mc.selections) {
      key = mc.selections.path.replace(/^\//, '');
      const v = ctx.data[key];
      current = Array.isArray(v) ? (v as string[]) : v != null ? [String(v)] : [];
    }
    return (
      <div className="flex flex-col gap-2">
        {label && <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>}
        {isMulti ? (
          <div className="flex flex-col gap-2">
            {mc.options.map((opt) => {
              const checked = current.includes(opt.value);
              const id = `mc-${ctx.surfaceId}-${node.id}-${opt.value}`;
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = v
                        ? [...current, opt.value]
                        : current.filter((x) => x !== opt.value);
                      store.setDataValue(ctx.surfaceId, key, next);
                    }}
                  />
                  <Label htmlFor={id} className="text-foreground cursor-pointer">
                    {resolveString(opt.label, ctx.data)}
                  </Label>
                </div>
              );
            })}
          </div>
        ) : (
          <RadioGroup
            value={current[0] ?? ''}
            onValueChange={(v) => store.setDataValue(ctx.surfaceId, key, [v])}
            className="flex flex-col gap-2"
          >
            {mc.options.map((opt) => {
              const id = `mc-${ctx.surfaceId}-${node.id}-${opt.value}`;
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={id} />
                  <Label htmlFor={id} className="text-foreground cursor-pointer">
                    {resolveString(opt.label, ctx.data)}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        )}
      </div>
    );
  }

  if ('CheckBox' in c) {
    const cb = c.CheckBox;
    const label = resolveString(cb.label, ctx.data);
    const key = cb.value.path.replace(/^\//, '');
    const checked = ctx.data[key] === true;
    const id = `cb-${ctx.surfaceId}-${node.id}`;
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => store.setDataValue(ctx.surfaceId, key, v === true)}
        />
        {label && (
          <Label htmlFor={id} className="text-foreground cursor-pointer">
            {label}
          </Label>
        )}
      </div>
    );
  }

  if ('Modal' in c) {
    const m = c.Modal;
    let isOpen = false;
    let openKey = '';
    if ('path' in m.open) {
      openKey = m.open.path.replace(/^\//, '');
      isOpen = ctx.data[openKey] === true;
    } else if ('literalBoolean' in m.open) {
      isOpen = m.open.literalBoolean;
    }
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          if (openKey) store.setDataValue(ctx.surfaceId, openKey, v);
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="sr-only">Modal</DialogTitle>
          </DialogHeader>
          {renderById(m.child, ctx)}
        </DialogContent>
      </Dialog>
    );
  }

  if ('Tabs' in c) {
    const t = c.Tabs;
    const key = t.selected.path.replace(/^\//, '');
    const selected = ctx.data[key] != null ? String(ctx.data[key]) : t.tabs[0]?.value ?? '';
    return (
      <Tabs
        value={selected}
        onValueChange={(v) => store.setDataValue(ctx.surfaceId, key, v)}
        className="w-full"
      >
        <TabsList>
          {t.tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="uppercase tracking-wider text-xs">
              {resolveString(tab.label, ctx.data)}
            </TabsTrigger>
          ))}
        </TabsList>
        {t.tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {renderById(tab.child, ctx)}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  if ('Icon' in c) {
    const name = resolveString(c.Icon.name, ctx.data);
    const size = c.Icon.size ?? 16;
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground" style={{ width: size, height: size }}>
        <span className="text-[0.75em] font-mono">{name.charAt(0).toUpperCase() || '•'}</span>
      </span>
    );
  }

  return <span className="text-destructive text-xs">unsupported: {Object.keys(c)[0]}</span>;
};

// Inline markdown — `code` chips and fenced ``` blocks. Anything else is
// passed through as plain text.
const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (text.startsWith('```')) {
    const stripped = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
    return (
      <pre className="rounded-md border border-border bg-input p-3 overflow-x-auto text-xs leading-relaxed font-mono text-foreground">
        <code>{stripped}</code>
      </pre>
    );
  }
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded border border-border px-1.5 py-0.5 text-[0.92em] font-mono"
          style={{
            background: 'color-mix(in oklab, var(--color-voltage) 20%, var(--color-paper))',
            color: 'var(--color-voltage)',
          }}
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
};

export const SurfaceWithId = ({
  surfaceId,
  surface,
}: {
  surfaceId: string;
  surface: SurfaceState;
}) => {
  const ctx = useMemo<Ctx>(
    () => ({ surfaceId, nodes: surface.components, data: surface.data }),
    [surfaceId, surface],
  );
  if (!surface.rootId) return null;
  return <>{renderById(surface.rootId, ctx)}</>;
};
