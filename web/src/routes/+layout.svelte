<!-- Root layout: sets the document head and renders the active page. -->
<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<meta name="description" content="A collection of browser bookmarklets for open-source intelligence gathering across social media platforms." />
</svelte:head>

{@render children()}
