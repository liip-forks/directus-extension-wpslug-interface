<template>
	<v-input
		v-if="isEditing && !disabled"
		:autofocus="true"
		:model-value="value"
		:placeholder="placeholder"
		:trim="trim"
		:slug="true"
		slug-separator="-"
		@update:model-value="onChange"
		@blur="disableEdit"
		@keydown="onKeyPress"
	>
		<template v-if="iconLeft || renderedPrefix || parentSlugs.length" #prepend>
			<v-icon v-if="iconLeft" :name="iconLeft" />
			<span class="prefixsuffix">
				{{ `${renderedPrefix}${parentSlugs.length > 0 ? `${parentSlugs.join('/')}/` : ''}` }}
			</span>
		</template>
		<template v-if="renderedSuffix" #append>
			<span class="prefixsuffix">{{ renderedSuffix }}</span>
		</template>
	</v-input>
	<div v-else class="link-preview-mode">
		<v-icon v-if="iconLeft" :name="iconLeft" class="icon-left" />

		<v-progress-circular v-if="parentsLoading" :indeterminate="true" />
		<template v-else>
			<a v-if="value && prefix" target="_blank" class="link" :href="presentedLink">{{ presentedLink }}</a>
			<span v-else class="link" @click="!disabled && enableEdit">{{ presentedLink }}</span>

			<v-button v-if="!disabled" v-tooltip="t('edit')" x-small secondary icon class="action-button" @click="enableEdit">
				<v-icon name="edit" />
			</v-button>

			<v-button
				v-if="isDiffer"
				v-tooltip="t('auto_generate')"
				x-small
				secondary
				icon
				class="action-button"
				@click="onResetToTemplateClick"
			>
				<v-icon name="auto_fix_high"/>
			</v-button>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, nextTick, watch, computed, PropType } from 'vue';
import { render } from 'micromustache';
import slugify from '@sindresorhus/slugify';
import { useI18n } from 'vue-i18n';
import { useApi } from '@directus/extensions-sdk';

export default defineComponent({
	props: {
		primaryKey: {
			type: [Number, String],
			required: true,
		},
		field: {
			type: String,
			default: null,
			required: true,
		},
		value: {
			type: String,
			default: null,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		placeholder: {
			type: String,
			default: null,
		},
		template: {
			type: String,
			default: '',
			required: true,
		},
		parent: {
			type: String,
			default: null,
		},
		prefix: {
			type: String,
			default: '',
		},
		suffix: {
			type: String,
			default: '',
		},
		iconLeft: {
			type: String,
			default: null,
		},
		length: {
			type: Number,
			default: null,
		},
		autofocus: {
			type: Boolean,
			default: false,
		},
		update: {
			type: Array as PropType<string[]>,
			default: () => ['create'],
		},
		collection: {
			type: String,
			required: true,
		},
	},
	emits: ['input'],
	setup(props, { emit, attrs }) {
	  const api = useApi();
		const { t } = useI18n();
		const values = inject('values', ref<Record<string, any>>({}));
		const savedParentId = computed<number>(() => values.value.parent);
		const parentSlugs = ref<string[]>([]);
		const parentsLoading = ref(false);
		const isEditing = ref<boolean>(props.autofocus);
		const isManuallyEdited = ref<boolean>(false);
		const cachedValueBeforeEdit = ref<string>(props.value);
		const trim = ref<boolean>(true);
		const renderedPrefix = computed<string>(() => render(props.prefix || '', values.value));
		const renderedSuffix = computed<string>(() => render(props.suffix || '', values.value));
	  const presentedLink = computed<string>(
			() =>
				`${renderedPrefix.value}${parentSlugs.value.length > 0 ? `${parentSlugs.value.join('/')}/` : ''}${
					props.value || props.placeholder || attrs['field-data']?.meta.field
				}${renderedSuffix.value}`
		);
		const isDiffer = computed<boolean>(() => {
			const transformed = transform(render(props.template, values.value));
			if (transformed === (props.value || '')) return false;
			return (transformed !== (props.value || '').replace(/-\d+$/, ''));
		});

		if (savedParentId.value) {
			parentsLoading.value = true;
			getParentSlugs(savedParentId.value).then(function (p) {
				parentSlugs.value = p;
				parentsLoading.value = false;
			});
		}

		watch(values, (newValues: Record<string, any>, oldValues: Record<string, any>) => {
			// Remove slugs if parent was removed
			if (oldValues[props.parent] && !newValues[props.parent]) {
				parentSlugs.value = [];
			}
			// Refresh parent slugs if parent changed
			if (newValues[props.parent] && newValues[props.parent] !== oldValues[props.parent]) {
				// newValues[props.parent] contain the parent id if a new parent was selected or a proxy object when the parent was edited
				const parentId: number =
					typeof newValues[props.parent] === 'number' ? newValues[props.parent] : newValues[props.parent].id;
				if (parentId) {
					parentsLoading.value = true;
					getParentSlugs(parentId).then(function (p) {
						parentSlugs.value = p;
						parentsLoading.value = false;
					});
				}
			}

			// Reject when manually edited.
			if (isEditing.value || isManuallyEdited.value) return;

			// According to the update policy.
			if (!(props.primaryKey !== '+' ? props.update.includes('update') : props.update.includes('create'))) return;

			// Avoid self update.
			if (newValues[props.field] && (newValues[props.field] || '') !== (props.value || '')) return;

			resetToTemplate(newValues);
		});

		return {
			t,
			values,
			parentsLoading,
			parentSlugs,
			renderedSuffix,
			renderedPrefix,
			presentedLink,
			isManuallyEdited,
			isEditing,
			trim,
			isDiffer,
			onResetToTemplateClick,
			onChange,
			onKeyPress,
			enableEdit,
			disableEdit,
		};

		async function getParentSlugs(id: number, parents: string[] = []): Promise<string[]> {
			if (id === Number(props.primaryKey)) {
				return parents;
			}

			if (!id) {
				return parents;
			}
			const response = await api.get(`/items/${props.collection}/${encodeURIComponent(id)}`, {
				params: {
					fields: [props.field, props.parent],
				},
			});
			if (response.data?.data && response.data?.data[props.parent]) {
				return await getParentSlugs(response.data.data[props.parent], [response.data.data[props.field], ...parents]);
			}
			return [response.data.data[props.field], ...parents];
		}

		function onKeyPress(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				// Temporary disable triming to avoid overwriting of the model value by the blur event inside v-input.
				trim.value = false;
				isManuallyEdited.value = false;
				emit('input', cachedValueBeforeEdit.value);
				nextTick(() => {
					disableEdit();
					trim.value = true;
				});
			} else if (event.key === 'Enter') {
				disableEdit();
			}
		}

		function onChange(value: string) {
			if (props.disabled) return;
			if (props.value === value) return;

			isManuallyEdited.value = Boolean(value && value.trim());

			// Emit exact value.
			emit('input', transform(value || ''));
		}

		function transform(value: string) {
			return slugify(value, { separator: '-', preserveTrailingDash: true }).slice(0, props.length);
		}

		function onResetToTemplateClick() {
			isManuallyEdited.value = false;
			resetToTemplate(values.value);
		}

		function resetToTemplate(values: Record<string, any>) {
			const newValue = transform(render(props.template, values));
			if (newValue === (props.value || '')) return;

			emit('input', newValue);
		}

		function enableEdit(): void {
			cachedValueBeforeEdit.value = props.value;
			isEditing.value = true;
		}

		function disableEdit(): void {
			isEditing.value = false;
		}
	},
});
</script>

<style lang="css" scoped>
.prefixsuffix {
	color: var(--foreground-subdued);
}

.link-preview-mode {
	display: flex;
	align-items: center;
	min-height: var(--input-height);
}

.icon-left {
	margin-right: 8px;
}

.action-button {
	margin-left: 8px;
}

.link {
	color: var(--foreground-subdued);
	text-decoration: underline;
	word-break: break-word;
}

a.link {
	color: var(--primary);
}

a.link:focus-visible,
a.link:hover {
	color: var(--primary-75);
}
</style>
