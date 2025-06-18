module.exports = {
	importOrder: [
		"<THIRD_PARTY_MODULES>",
		"^[./]",
		"^constants/(.*)$",
	],
	importOrderCaseInsensitive: true,
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
	plugins: ["@trivago/prettier-plugin-sort-imports"],
	printWidth: 120,
	useTabs: true,
};
