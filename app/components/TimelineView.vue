<script setup lang="ts">
import { CalendarDays, Camera, Edit3, ImagePlus, LoaderCircle, MapPin, MoreHorizontal, Plus, Trash2, X } from '@lucide/vue'
import type { Memory, MemoryPhoto } from '~/composables/useMemories'
import { refreshMediaElement } from '~/composables/useMediaUrls'

const { memories, memoriesLoading, memoriesLoadingMore, memoriesHasMore, loadMemories, loadMoreMemories, createMemory, updateMemory, deleteMemory } = useMemories()
const { $supabase } = useNuxtApp()
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const content = ref('')
const memoryDate = ref(new Date().toISOString().slice(0, 10))
const location = ref('')
const keptPhotos = ref<MemoryPhoto[]>([])
const selectedFiles = ref<File[]>([])
const previews = ref<string[]>([])
const saving = ref(false)
const errorMessage = ref('')
const menuId = ref<string | null>(null)

async function handleTimelineScroll() {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) await loadMoreMemories()
}
onMounted(async () => { await loadMemories(); window.addEventListener('scroll', handleTimelineScroll, { passive: true }) })
onBeforeUnmount(() => window.removeEventListener('scroll', handleTimelineScroll))

function openCreate() { resetEditor(); editorOpen.value = true }
function openEdit(memory: Memory) {
  editingId.value = memory.id; content.value = memory.content; memoryDate.value = memory.memoryDate; location.value = memory.location; keptPhotos.value = [...memory.photos]; selectedFiles.value = []; previews.value = []; editorOpen.value = true; menuId.value = null
}
function resetEditor() { editingId.value = null; content.value = ''; memoryDate.value = new Date().toISOString().slice(0, 10); location.value = ''; keptPhotos.value = []; selectedFiles.value = []; previews.value.forEach(URL.revokeObjectURL); previews.value = []; errorMessage.value = '' }
function closeEditor() { editorOpen.value = false; resetEditor() }
function selectFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []).filter(file => file.type.startsWith('image/'))
  if (files.some(file => file.size > 8 * 1024 * 1024)) { errorMessage.value = '单张图片不能超过 8 MB'; return }
  if (files.length + keptPhotos.value.length > 6) { errorMessage.value = '每条回忆最多上传 6 张图片'; return }
  previews.value.forEach(URL.revokeObjectURL); selectedFiles.value = files; previews.value = files.map(URL.createObjectURL); errorMessage.value = ''
}
async function save() {
  if (!content.value.trim()) { errorMessage.value = '写一点这天发生的故事吧'; return }
  saving.value = true; errorMessage.value = ''
  try {
    const input = { content: content.value.trim(), memoryDate: memoryDate.value, location: location.value.trim(), photos: keptPhotos.value }
    editingId.value ? await updateMemory(editingId.value, input, selectedFiles.value) : await createMemory(input, selectedFiles.value)
    closeEditor()
  } catch (error: any) { errorMessage.value = error.message || '保存失败，请稍后再试' } finally { saving.value = false }
}
async function remove(memory: Memory) { if (confirm('确定删除这条共同回忆吗？')) await deleteMemory(memory); menuId.value = null }
function formatDate(date: string) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00`)) }
async function refreshMemoryPhoto(event: Event, photo: MemoryPhoto) { await refreshMediaElement(event, $supabase, photo.path, photo.path.includes('/album-media/') ? 'album-media' : 'memory-photos', { width: 1200, height: 1200, resize: 'contain', quality: 82 }) }

defineExpose({ openCreate })
</script>

<template>
  <section class="timeline-view">
    <header class="timeline-header">
      <div><p class="eyebrow">OUR MEMORIES</p><h1>我们的时光</h1><span>一起收藏那些值得反复想起的日子。</span></div>
      <button class="new-memory" type="button" @click="openCreate"><Plus :size="18" /> 记录此刻</button>
    </header>
    <div class="timeline-summary"><div><strong>{{ memories.length }}</strong><span>共同回忆</span></div><i /><div><strong>{{ memories.reduce((sum, item) => sum + item.photos.length, 0) }}</strong><span>珍藏照片</span></div><Camera :size="24" /></div>
    <div v-if="memoriesLoading" class="timeline-state"><LoaderCircle class="spin" :size="24" /> 正在打开时光册</div>
    <div v-else-if="!memories.length" class="timeline-state empty"><ImagePlus :size="34" /><h3>第一条回忆，从今天开始</h3><p>写下故事，也可以加上照片和地点。</p><button type="button" @click="openCreate">创建回忆</button></div>
    <div v-else class="timeline-list">
      <article v-for="memory in memories" :key="memory.id" class="timeline-entry">
        <div class="timeline-date"><span>{{ memory.memoryDate.slice(5, 7) }}月</span><strong>{{ memory.memoryDate.slice(8, 10) }}</strong></div>
        <div class="timeline-dot" />
        <div class="memory-card">
          <div class="memory-card-head"><span>{{ formatDate(memory.memoryDate) }} · {{ memory.authorName }} 记录</span><div class="entry-menu"><button type="button" aria-label="更多操作" @click="menuId = menuId === memory.id ? null : memory.id"><MoreHorizontal :size="20" /></button><div v-if="menuId === memory.id"><button type="button" @click="openEdit(memory)"><Edit3 :size="15" /> 编辑</button><button class="danger" type="button" @click="remove(memory)"><Trash2 :size="15" /> 删除</button></div></div></div>
          <div v-if="memory.photos.length" class="photo-grid" :class="`count-${Math.min(memory.photos.length, 3)}`"><template v-for="photo in memory.photos" :key="photo.path || photo.url"><div v-if="!photo.url" class="photo-placeholder"><LoaderCircle class="spin" :size="18"/></div><img v-else :src="photo.url" alt="共同回忆照片" loading="lazy" decoding="async" @error="refreshMemoryPhoto($event, photo)"></template></div>
          <p>{{ memory.content }}</p>
          <div v-if="memory.location" class="entry-location"><MapPin :size="14" /> {{ memory.location }}</div>
        </div>
      </article>
    </div>
    <div v-if="memoriesLoadingMore" class="timeline-loading-more"><LoaderCircle class="spin" :size="15" /> 正在加载更早的回忆</div>
    <div v-else-if="!memoriesHasMore && memories.length" class="timeline-end">已经看到最早的一页回忆</div>

    <div v-if="editorOpen" class="editor-overlay" @click.self="closeEditor">
      <section class="memory-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header><div><p class="eyebrow">NEW STORY</p><h2 id="editor-title">{{ editingId ? '编辑这段时光' : '记录此刻' }}</h2></div><button type="button" aria-label="关闭" @click="closeEditor"><X :size="20" /></button></header>
        <label class="story-field"><span>这天发生了什么？</span><textarea v-model="content" maxlength="1000" rows="6" placeholder="把想记住的细节写下来……" /><small>{{ content.length }}/1000</small></label>
        <div class="field-row"><label><span>日期</span><div><CalendarDays :size="17" /><input v-model="memoryDate" type="date"></div></label><label><span>地点</span><div><MapPin :size="17" /><input v-model="location" maxlength="80" placeholder="在哪里留下的回忆"></div></label></div>
        <div class="photo-field"><div><span>照片</span><small>最多 6 张，单张不超过 8 MB</small></div><div v-if="keptPhotos.length || previews.length" class="preview-grid"><div v-for="(photo, index) in keptPhotos" :key="photo.url"><img :src="photo.url" alt="已上传照片"><button type="button" aria-label="移除照片" @click="keptPhotos.splice(index, 1)"><X :size="13" /></button></div><div v-for="preview in previews" :key="preview"><img :src="preview" alt="待上传照片"></div></div><label class="upload-button"><ImagePlus :size="18" /> 选择照片<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="selectFiles"></label></div>
        <p v-if="errorMessage" class="editor-error">{{ errorMessage }}</p>
        <footer><button type="button" @click="closeEditor">取消</button><button class="save-button" type="button" :disabled="saving" @click="save"><LoaderCircle v-if="saving" class="spin" :size="17" /> {{ editingId ? '保存修改' : '保存回忆' }}</button></footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.timeline-header h1{font-weight:800!important;color:#4d2c57}.new-memory{border-radius:23px!important;background:linear-gradient(135deg,#8b4db9,#d85f99)!important;box-shadow:0 13px 27px rgba(131,63,157,.22)}.timeline-summary{border-color:rgba(180,102,210,.2)!important;border-radius:29px!important;background:linear-gradient(135deg,rgba(239,218,255,.82),rgba(255,226,238,.8))!important}.memory-card{border-color:rgba(179,113,204,.18)!important;border-radius:29px!important;background:rgba(255,250,255,.9)!important;box-shadow:0 20px 48px rgba(101,57,120,.1)!important}.timeline-dot{background:#d76fa4!important;box-shadow:0 0 0 4px rgba(194,121,222,.2)!important}.memory-editor{border-radius:32px!important;background:linear-gradient(145deg,#fffaff,#fff5fa)!important}.story-field textarea,.field-row label>div{border-radius:20px!important}.save-button{border-radius:22px!important;background:linear-gradient(135deg,#8b4db9,#d85f99)!important}
.timeline-view{width:min(100%,1000px);margin:0 auto}.timeline-header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:14px 0 28px}.timeline-header h1{margin:0 0 7px;font-size:32px;font-weight:650}.timeline-header>div>span{color:#89818f;font-size:13px}.new-memory,.save-button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border:0;border-radius:15px;background:#332f3a;color:#fff;font-size:12px;font-weight:750;cursor:pointer}.timeline-summary{display:flex;align-items:center;gap:22px;padding:22px 26px;border:1px solid rgba(102,82,126,.08);border-radius:22px;background:rgba(255,255,255,.78);box-shadow:0 14px 40px rgba(76,59,96,.05)}.timeline-summary div{display:flex;align-items:baseline;gap:7px}.timeline-summary strong{font-size:25px}.timeline-summary span{color:#8c8494;font-size:11px}.timeline-summary i{width:1px;height:28px;background:#e8e3eb}.timeline-summary>svg{margin-left:auto;color:#c193a8}.timeline-list{position:relative;margin-top:32px}.timeline-list:before{content:'';position:absolute;top:8px;bottom:0;left:86px;width:1px;background:#dfd7e7}.timeline-entry{position:relative;display:grid;grid-template-columns:62px 18px 1fr;gap:16px;margin-bottom:26px}.timeline-date{text-align:right}.timeline-date span,.timeline-date strong{display:block}.timeline-date span{color:#a097a8;font-size:10px}.timeline-date strong{font-size:22px;font-weight:620}.timeline-dot{z-index:1;width:11px;height:11px;margin:8px auto 0;border:3px solid #faf9fc;border-radius:50%;background:#b098d5;box-shadow:0 0 0 1px #c5b4dd}.memory-card{min-width:0;padding:22px;border:1px solid rgba(102,82,126,.08);border-radius:22px;background:rgba(255,255,255,.88);box-shadow:0 16px 42px rgba(76,59,96,.055)}.memory-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;color:#a097a8;font-size:10px}.entry-menu{position:relative}.entry-menu>button{display:grid;place-items:center;width:34px;height:30px;border:0;border-radius:10px;background:transparent;color:#8f8697;cursor:pointer}.entry-menu>div{position:absolute;z-index:3;right:0;top:34px;min-width:105px;padding:6px;border:1px solid #e9e3ec;border-radius:12px;background:white;box-shadow:0 12px 30px rgba(60,47,72,.12)}.entry-menu>div button{display:flex;align-items:center;gap:7px;width:100%;padding:8px;border:0;border-radius:8px;background:transparent;font-size:11px;cursor:pointer}.entry-menu .danger{color:#bd5776}.photo-grid{display:grid;gap:6px;overflow:hidden;margin-bottom:16px;border-radius:16px}.photo-grid img{width:100%;height:100%;min-height:190px;max-height:380px;object-fit:cover}.photo-grid.count-2,.photo-grid.count-3{grid-template-columns:repeat(2,1fr)}.photo-grid.count-3 img:first-child{grid-row:span 2}.memory-card>p{margin:0;color:#5f5865;font-size:13px;line-height:1.85;white-space:pre-wrap}.entry-location{display:flex;align-items:center;gap:6px;margin-top:14px;color:#9b8fa2;font-size:10px}.timeline-state{display:flex;align-items:center;justify-content:center;gap:10px;min-height:320px;color:#938a9b;font-size:12px}.timeline-state.empty{flex-direction:column;text-align:center}.timeline-state.empty svg{color:#b79ed9}.timeline-state.empty h3{margin:8px 0 0;color:#403a46;font-size:17px}.timeline-state.empty p{margin:0}.timeline-state.empty button{margin-top:12px;padding:10px 15px;border:0;border-radius:13px;background:#eee8f7;color:#705794;font-weight:700}.editor-overlay{position:fixed;z-index:60;inset:0;display:grid;place-items:center;padding:20px;background:rgba(45,39,52,.28);backdrop-filter:blur(10px)}.memory-editor{overflow:auto;width:min(100%,620px);max-height:calc(100vh - 40px);padding:28px;border:1px solid rgba(255,255,255,.9);border-radius:25px;background:#fdfcfe;box-shadow:0 30px 80px rgba(50,39,61,.18)}.memory-editor>header{display:flex;justify-content:space-between}.memory-editor h2{margin:0;font-size:23px}.memory-editor>header button{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:12px;background:#f0ebf5;cursor:pointer}.story-field,.field-row label{display:block}.story-field{position:relative;margin-top:24px}.story-field>span,.field-row label>span,.photo-field>div:first-child>span{display:block;margin-bottom:8px;color:#655e6c;font-size:11px;font-weight:700}.story-field textarea{width:100%;resize:vertical;padding:15px;border:1px solid #e5dfe8;border-radius:15px;outline:0;background:white;font:inherit;font-size:13px;line-height:1.7}.story-field textarea:focus{border-color:#b8a2db;box-shadow:0 0 0 4px rgba(168,139,216,.1)}.story-field>small{position:absolute;right:12px;bottom:10px;color:#aaa2b1;font-size:9px}.field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:17px}.field-row label>div{display:flex;align-items:center;gap:9px;height:47px;padding:0 13px;border:1px solid #e5dfe8;border-radius:14px;background:#fff;color:#9f96a7}.field-row input{width:100%;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:11px}.photo-field{margin-top:19px}.photo-field>div:first-child{display:flex;justify-content:space-between}.photo-field>div:first-child small{color:#a49ca9;font-size:9px}.preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}.preview-grid>div{position:relative;aspect-ratio:1}.preview-grid img{width:100%;height:100%;border-radius:11px;object-fit:cover}.preview-grid button{position:absolute;top:4px;right:4px;display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:8px;background:rgba(38,33,43,.7);color:white}.upload-button{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border:1px dashed #cdbfe0;border-radius:13px;background:#f7f3fb;color:#795fa0;font-size:11px;font-weight:700;cursor:pointer}.editor-error{margin:12px 0 0;color:#bd5776;font-size:11px}.memory-editor>footer{display:flex;justify-content:flex-end;gap:10px;margin-top:23px}.memory-editor>footer>button{min-height:44px;padding:0 18px;border:0;border-radius:14px;background:#f0ebf3;font-size:11px;font-weight:700;cursor:pointer}.memory-editor>footer>.save-button{background:#332f3a;color:white}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.photo-placeholder{display:grid;place-items:center;min-height:190px;background:linear-gradient(135deg,#f1eaf5,#fbeef4);color:#b18ec1}
.timeline-loading-more,.timeline-end{display:flex;align-items:center;justify-content:center;gap:7px;padding:18px;color:#927e96;font-size:10px}.timeline-end{color:#aa9bab}
@media(max-width:650px){.timeline-header{align-items:flex-start}.timeline-header h1{font-size:26px}.timeline-header>div>span{font-size:11px}.new-memory{width:44px;padding:0;font-size:0}.timeline-summary{padding:18px}.timeline-list:before{left:8px}.timeline-entry{grid-template-columns:18px 1fr;gap:10px}.timeline-date{display:none}.timeline-dot{grid-column:1}.memory-card{grid-column:2;padding:16px}.photo-grid img{min-height:135px}.editor-overlay{padding:0;align-items:end}.memory-editor{max-height:92vh;padding:22px 18px calc(22px + env(safe-area-inset-bottom));border-radius:25px 25px 0 0}.field-row{grid-template-columns:1fr}.preview-grid{grid-template-columns:repeat(3,1fr)}}
</style>
<style scoped>
@media(max-width:650px){.editor-overlay{inset:0;padding:max(8px,env(safe-area-inset-top)) 0 max(8px,env(safe-area-inset-bottom));align-items:end}.memory-editor{display:flex;width:100%;height:auto;max-height:calc(100dvh - max(8px,env(safe-area-inset-top)) - max(8px,env(safe-area-inset-bottom)));padding:20px 16px 0;flex-direction:column;overflow-y:auto;border-radius:24px 24px 0 0!important}.memory-editor>footer{position:sticky;z-index:6;bottom:0;width:auto;margin:18px -16px 0;padding:12px 16px max(14px,env(safe-area-inset-bottom));background:#fff8fc;box-shadow:0 -10px 28px rgba(84,48,96,.09)}.memory-editor>footer>button{min-height:48px}.memory-editor>footer>.save-button{min-width:0;flex:1;justify-content:center;white-space:nowrap}}
</style>
<style scoped>
@media(max-width:650px){.editor-overlay{padding-top:env(safe-area-inset-top)}.memory-editor{max-height:calc(100dvh - env(safe-area-inset-top))}.timeline-header h1{font-size:23px!important}.memory-card>p{font-size:12px}}
</style>
