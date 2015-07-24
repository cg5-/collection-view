
Package.describe({
	summary: "Perform data transformations on cursors without sacrificing fine-grained reactivity.",
	version: "0.1.1",
	name: "cg5:collection-view",
	git: "https://github.com/cg5-/collection-view.git"
});

Package.onUse(function (api) {
	api.versionsFrom("1");
	api.use("tomi:es6@0.0.66");
	api.use("underscore");
	api.use("minimongo");
	api.use("mongo", null, {weak: true});
	api.use("tracker", "client");
	api.use("ejson");

	api.addFiles([
		"lib/view.next.js",
		"lib/utils.next.js",
		"lib/ordered_view.next.js",
		"lib/suspend_view.next.js",
		"lib/reified_view.next.js",
		"lib/collection_view.next.js",
		"lib/cursor_view.next.js",
		"lib/map_view.next.js",
		"lib/pick_omit_view.next.js",
		"lib/add_fields_view.next.js",
		"lib/filter_view.next.js",
		"lib/group_view.next.js",
		"lib/union_view.next.js"
	]);

	api.export("CV");
});

Package.onTest(function (api) {
	api.versionsFrom("1");
	api.use("tomi:es6@0.0.66");
	api.use("cg5:collection-view");
	api.use("underscore");
	api.use("tinytest");
	api.use("minimongo");
	api.use("mongo");
	api.use("tracker");
	api.use("ejson");

	api.addFiles([
		"tests/helpers.next.js",
		"tests/collection_view_tests.next.js",
		"tests/cursor_view_tests.next.js",
		"tests/map_view_tests.next.js",
		"tests/pick_omit_view_tests.next.js",
		"tests/add_fields_view_tests.next.js",
		"tests/filter_view_tests.next.js",
		"tests/group_view_tests.next.js",
		"tests/union_view_tests.next.js",
		"tests/premier_league_tests.next.js"
	], "client");

	api.export("testHelpers");
});
