+++
date = '2026-07-14T21:48:45+09:00'
draft = false
title = 'Who Should Own the Form?'
description = 'Where to call useForm() turned out to be a question of form-state ownership. A walk through comparing page-level, Layout-level, and a global store.'
tags = ["React", "State Management", "Design"]
series = ['Form Design Troubleshooting']
+++

The first problem I ran into after adopting RHF was where to call `useForm()`. It wasn't really a question of where to put a hook — it was a question of where form state ownership should live.

## Should the Page Own the Form?

The first approach that came to mind was having each edit page call its own `useForm()`.

```tsx
function ItemFormPage() {
  const form = useForm();

  return (
    <FormProvider {...form}>
      <ItemForm />
    </FormProvider>
  );
}
```

But in this editor, the save button wasn't on the page — it was in the header. If the page owns the form, the header has no way to reach it.

```text
Layout
 ├─ Header (the save button lives here)
 └─ Outlet
     └─ Page
         └─ useForm() // header can't reach it
```

### What if I pass it down as props?

```tsx
<Layout form={form}>
  <Page form={form} /> // just pass form down like this!
</Layout>
```

But our service managed fairly complex data, so there were already multiple edit pages, one per entity. On top of that, the number of UI pieces that needed form state kept growing — the save button, validation error displays, and a bunch of other UI components all needed access to form state. Each of those UI pieces could have its own child elements too, which meant the components in between had to accept props they didn't even need, just to pass them further down. Classic props drilling.

## Giving Layout Ownership of the Form!

The common parent of all the components that needed the form was Layout, so it made sense to move form ownership up there too.
So I decided to call `useForm()` only once, in Layout, instead of in each page. Each page, instead, would just declare its own schema and default values through the route's `handle`.

```tsx
// each page only declares its own form config
{
  path: 'items/:id',
  element: <ItemFormPage />,
  handle: { formConfig: ItemFormPage.formConfig },
}
```

Layout reads the current route's `formConfig` via `useMatches()` and builds the form from it.

```tsx
const matches = useMatches();
const config = matches[matches.length - 1]?.handle?.formConfig;

const methods = useForm({
  resolver: config?.schema ? zodResolver(config.schema) : undefined,
  defaultValues: config?.defaultValues,
});

return (
  <FormProvider {...methods}>
    <Sidebar />
    <Outlet />
  </FormProvider>
);
```

This solved two things at once. The header could now reach `handleSubmit` with a single `useFormContext()` call, and adding a new entity page meant just declaring a schema — no need to repeat the `useForm` boilerplate.

Right now all 27 edit forms in the editor run on this structure. `formConfig` also carries a `transformSubmit` function (which converts form values into the shape the server contract expects) alongside `schema` and `defaultValues`, so Layout handles everything related to running the form.

### Why not just use a global store?

At first, honestly, the difference between context and store felt fuzzy to me. Both let multiple components pull values out. If you wrap the top level in a context, why would you need a store? And the other way around — if a store works fine, why bother with context?

This work gave me a clear way to tell them apart, though.

```
context -> good for sharing the same value within a specific component tree
store -> when you need global access to / changes on state, regardless of tree
```

What this work needed wasn't state shared across the whole application — it was the same form instance shared within a single screen.

So Context was the better fit. `const form = useForm()` — that object holds all the form management functionality, `handleSubmit`, `reset`, `formState`, and more. The important part isn't sharing values, it's sharing one form instance.

I could have used a global store like zustand, but in this case the scope of the state would have grown too wide. The form only makes sense within this screen, and if it becomes reachable from anywhere in the domain, the scope gets blurry. Context's constraint of being reachable only within its tree actually kept the scope clear.

## Nailed It?

Now that Layout owned the form, everything was solved, right? ...Not quite.

### Feeding in server data

When Layout first mounts, `defaultValues` get set on the form. But `defaultValues` are, well, default values — not the actual data that comes back from the server. They only apply at the moment `useForm` is created, so when the response arrives asynchronously later, it doesn't automatically flow into the form. So once the response came in, I had to inject the values manually with `reset`.

```tsx
const { reset } = useFormContext();
const hasInitialized = useRef(false);

useEffect(() => {
  if (response && !hasInitialized.current) {
    // lock this so reset only fires once
    reset(response.data);
    hasInitialized.current = true;
  }
}, [response]); // resetting every time the response changes would overwrite whatever the user's typing, so just once
```

### Resetting every time the page changes

That fixed getting server data into the form on first entry. But another problem was still there. Inside a Layout Route, when the route changes, Layout stays mounted — only the Page inside Outlet gets swapped out.

Which meant the form instance Layout created stayed alive too. So navigating to a different entity's edit page left whatever the previous page's inputs behind. `hasInitialized` was already `true`, so it wouldn't reset with the new server data either. I fixed it by re-initializing the form whenever the route changed, keyed on the entity id.

```ts
useEffect(() => {
  reset(defaultValues);
}, [id]); // reset whenever the entity id changes
```

## What I Learned

I thought this was just about solving how the save button could reach the form, but it turned out to be a much bigger job of redesigning form ownership. All I wanted was to move one button into the header, and it ended up touching the route structure, the schemas, and every form page component.

I came away with a rule of thumb: the more components need to reference the same form instance, the more it makes sense to move ownership up. If not, it's more natural to create it as close to where it's used as possible.

There were tradeoffs too, of course. Since every entity's form has a different schema, Layout's `useForm` couldn't be pinned to a specific form type, so the types ended up looser than I'd like (I made up for that with schema-level unit tests). And sharing one form instance meant reset responsibility followed me around everywhere. Still, compared to eliminating boilerplate across 27 forms, it was a cost worth paying.
