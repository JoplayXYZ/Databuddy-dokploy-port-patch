# Dashboard Design System Rules

The dashboard design system in this folder is the source of truth for app UI.
When updating or creating dashboard UI, use these primitives directly instead of
raw controls or one-off styled components.

## Hard Rules

- Feature code must not use raw form or control elements such as `button`,
  `input`, `select`, `textarea`, native dialogs, Base UI primitives, Radix
  primitives, or ad hoc trigger shells.
- Raw controls are allowed inside `components/ds` implementations only.
- If a needed control, variant, size, or composition does not exist, add or
  extend a DS primitive first, then use that DS primitive in the feature.
- Prefer the exact existing DS API and styling tokens over local class stacks.
- Use icons from the existing icon packages used by the app. Do not create
  manual SVG controls in feature code.

## Which Primitive To Use

- `Button`: primary, secondary, destructive, icon, and command actions.
- `Field` + `Input` / `Textarea` / `Checkbox` / `Switch` / `TagsInput`:
  labeled form controls with descriptions, errors, ids, and accessibility
  wiring.
- `DropdownMenu`: menu-style pickers and commands, including folder, status,
  filter, sort, action, and row menus.
- `Select`: only for an actual select or combobox pattern. Do not use it as a
  generic dropdown menu.
- `Sheet`, `Dialog`, `DeleteDialog`, `Popover`: overlays and contained flows.
- `Tabs`, `Accordion`, `SegmentedControl`: view switching and progressive
  disclosure.
- `Card`, `Badge`, `EmptyState`, `Text`, `Divider`, `Spinner`, `Progress`:
  structure, messaging, typography, and status.
- `control-shell`: shared trigger-shell styling for DS components that need a
  custom trigger wrapper.

## Dropdown Example

Use `DropdownMenu` for folder/status/filter style choices:

```tsx
<DropdownMenu>
	<DropdownMenu.Trigger className={fieldControlShell()}>
		<span className="truncate">{label}</span>
		<CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start" className="w-56">
		<DropdownMenu.Group>
			<DropdownMenu.GroupLabel>Folder</DropdownMenu.GroupLabel>
			<DropdownMenu.Item onClick={() => onChange("")}>
				Unfiled
			</DropdownMenu.Item>
			{folders.map((folder) => (
				<DropdownMenu.Item
					key={folder.id}
					onClick={() => onChange(folder.id)}
				>
					{folder.name}
				</DropdownMenu.Item>
			))}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu>
```

Do not replace that pattern with native `<select>` or `Select` unless the UI is
actually a select or combobox.
