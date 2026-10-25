import React from 'react';
import ForgeReconciler, { Heading, Stack, Text, SectionMessage } from '@forge/react';

// Starter search page. The builder, CQL box, results, saved searches and bulk actions are added by later patches
// (SPEC.md §14).
const App = () => (
  <Stack space="space.200">
    <Heading as="h2">Query &amp; Bulk Actions</Heading>
    <SectionMessage appearance="information" title="Installed">
      <Text>The app is installed on this site. Searching arrives in the next update.</Text>
    </SectionMessage>
    <Text>
      When it's ready, this page will let you check a Confluence query before it runs, save and share it, show live results on any
      page, and act on the results in bulk: add, rename or merge labels, watch pages or archive them, always with a preview first.
    </Text>
  </Stack>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
