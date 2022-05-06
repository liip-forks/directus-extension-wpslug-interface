import { defineInterface } from '@directus/extensions-sdk';
import { useStores } from '@directus/extensions-sdk';
import InterfaceSlug from './slug.vue';
import { useI18n, LocaleMessageObject, VueMessageType } from 'vue-i18n';

enum AvailableLanguages {
	'en-GB' = 'en-GB',
	'de-DE' = 'de-DE',
}
const MESSAGES: {
	[key in AvailableLanguages]: LocaleMessageObject<VueMessageType>;
} = {
	[AvailableLanguages['de-DE']]: {
		parent: 'Eltern',
	},
	[AvailableLanguages['en-GB']]: {
		parent: 'Parent',
	},
};

const MESSAGE_NAMESPACE = 'directus_extension_wpslug_interface';

export default defineInterface({
	id: 'extension-wpslug',
	name: 'Slug',
	description: 'WordPress alike slug/permalink interface',
	icon: 'link',
	component: InterfaceSlug,
	types: ['string'],
	group: 'standard',
	options: ({ collection }) => {
		const store = useStores();
		const fieldsStore = store.useFieldsStore();
		const i18n = useI18n();

		Object.values(AvailableLanguages).forEach(async (lang) => {
			i18n.mergeLocaleMessage(lang, {
				[MESSAGE_NAMESPACE]: MESSAGES[lang],
			});
		});

		const fields: { text: string; value: string | null; relations: any }[] = fieldsStore
			.getFieldsForCollection(collection)
			.map((field) => {
				return { text: field.name, value: field.field, relations: field.relations };
			});

		return [
			{
				field: 'placeholder',
				name: '$t:placeholder',
				meta: {
					width: 'full',
					interface: 'input',
					options: {
						placeholder: '$t:enter_a_placeholder',
					},
				},
			},
			{
				field: 'template',
				type: 'string',
				name: '$t:template',
				meta: {
					width: 'full',
					interface: 'system-display-template',
					required: true,
					options: {
						collectionName: collection,
						font: 'monospace',
						placeholder: '{{ title }}-{{ id }}',
					},
				},
			},
			{
				field: 'parent',
				type: 'string',
				name: `$t:${MESSAGE_NAMESPACE}.parent`,
				meta: {
					width: 'full',
					interface: 'select-dropdown',
					required: false,
					options: {
						placeholder: '$t:primary_key',
						showDeselect: true,
						choices: fields,
					},
				},
			},
			{
				field: 'iconLeft',
				name: '$t:icon_left',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'select-icon',
				},
			},
			{
				field: 'prefix',
				type: 'string',
				name: '$t:prefix',
				meta: {
					width: 'full',
					interface: 'system-display-template',
					options: {
						collectionName: collection,
						font: 'monospace',
						placeholder: 'http://example.com/',
					},
				},
			},
			{
				field: 'suffix',
				type: 'string',
				name: '$t:suffix',
				meta: {
					width: 'full',
					interface: 'system-display-template',
					options: {
						collectionName: collection,
						font: 'monospace',
						placeholder: '/',
					},
				},
			},
			{
				field: 'update',
				name: '$t:auto_generate',
				type: 'json',
				meta: {
					width: 'half',
					interface: 'select-multiple-checkbox',
					options: {
						choices: [
							{ text: '$t:on_create', value: 'create' },
							{ text: '$t:on_update', value: 'update' },
						],
					},
				},
				schema: {
					default_value: ['create'],
				},
			},
		];
	},
});
