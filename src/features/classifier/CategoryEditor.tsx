import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Overview, DomainId } from "../../lib/mailbox";
import { setMailCategory } from "./classification.functions";

export function CategoryEditor({
  ownerKey,
  mailId,
  currentCategory,
  overview,
  onSaved,
}: {
  ownerKey: string;
  mailId: string;
  currentCategory: string;
  overview: Overview;
  onSaved: (domainId: DomainId, subcategoryId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentCategory);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      setMailCategory({ data: { mailId, subcategoryId: selected } }),
    onSuccess: async () => {
      const domain = overview.domains.find((entry) =>
        entry.subcategories.some((category) => category.id === selected),
      );
      if (domain) onSaved(domain.id, selected);
      setEditing(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["mailbox", ownerKey] }),
        client.invalidateQueries({ queryKey: ["classification", ownerKey] }),
      ]);
    },
  });
  return (
    <div className="category-editor">
      <button className="text-button" onClick={() => setEditing(!editing)}>
        修改分類
      </button>
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label>
            分類
            <select
              aria-label="分類"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {overview.domains.map((domain) => (
                <optgroup key={domain.id} label={domain.name}>
                  {domain.subcategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="text-button" disabled={save.isPending}>
            保存
          </button>
          {save.isError && <p role="alert">分類保存失敗，請重試。</p>}
        </form>
      )}
    </div>
  );
}
