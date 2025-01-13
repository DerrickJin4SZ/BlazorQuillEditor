// quillInterop.js

const quillInstances = new Map();

/**
 * 初始化 Quill 编辑器
 * @param {string} toolbarId - 工具栏容器的 ID
 * @param {string} editorId - 编辑器容器的 ID
 * @param {object|string} toolbarOptions - 工具栏配置
 * @param {string} placeholderContent - 占位符文本
 * @param {DotNetObjectReference} dotNetHelper - Blazor 对象引用，用于调用 C# 方法
 * @param {string} theme - 编辑器主题
 * @param {boolean} uploadImage - 是否支持图片上传
 * @param {string} imageAPI - 图片上传的 API 地址
 */
export function initializeEditor(toolbarId, editorId, toolbarOptions = true, placeholderContent = "", dotNetHelper = null, theme = "snow", uploadImage = true, imageAPI ="/api/upload/image") {
    console.log("Initializing Quill editor...");

    const toolbarContainer = document.getElementById(toolbarId);
    const editorContainer = document.getElementById(editorId);

    if (!toolbarContainer) {
        console.error(`Toolbar container with ID "${toolbarId}" not found.`);
        return;
    }

    if (!editorContainer) {
        console.error(`Editor container with ID "${editorId}" not found.`);
        return;
    }

    let toolbar;
    // 解析 toolbarOptions，如果是字符串，则尝试解析为 JSON 对象
    if (typeof toolbarOptions === 'string') {
        try {
            toolbar = JSON.parse(toolbarOptions);
        } catch (e) {
            console.error("Invalid toolbarOptions JSON string. Using default toolbar.");
            toolbar = true;
        }
    } else {
        toolbar = toolbarOptions;
    }

    const options = {
        modules: {
            toolbar: toolbar,
            clipboard: {
                // 禁用默认的粘贴图片处理
                matchers: []
            }
        },
        placeholder: placeholderContent,
        theme: theme
    };

    const quill = new Quill(`#${editorId}`, options);

    // 监听内容变化事件
    quill.on('text-change', () => {
        if (dotNetHelper) {
            const content = quill.getContents(); // 获取 Delta
            dotNetHelper.invokeMethodAsync('ReceiveDeltaContentChanged', JSON.stringify(content));
            const htmlcontent = quill.root.innerHTML;
            dotNetHelper.invokeMethodAsync('ReceiveContentChanged', htmlcontent);
        }
    });
    // 处理图片插入
    quill.getModule('toolbar').addHandler('image', () => {
        if (uploadImage) {
            //console.log(imageAPI)
            selectLocalImageWithUpload(quill, dotNetHelper, imageAPI);
        } else {
            selectLocalImageWithBase64(quill, dotNetHelper);
        }
    });

    // 处理视频插入
    quill.getModule('toolbar').addHandler('video', () => {
        insertVideo(quill, dotNetHelper);
    });
    // 添加拖放图片支持（可选）
    quill.root.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (/^image\//.test(file.type)) {
                await uploadImage(quill, file, imageAPI);
            }
        }
    });
    // 处理粘贴事件中的图片插入
    quill.root.addEventListener('paste', (e) => {
        if (!uploadImage) return;

        const clipboardData = e.clipboardData || window.clipboardData;
        if (clipboardData) {
            const items = clipboardData.items || clipboardData.files;
            let hasImage = false;
            for (let i = 0; i < items.length; i++) {
                if (/^image\//.test(items[i].type)) {
                    hasImage = true;
                    break;
                }
            }

            if (hasImage) {
                // 同步阻止默认行为
                e.preventDefault();
                e.stopPropagation();

                // 异步处理图片上传
                overwriteParseImage(e, quill, imageAPI).catch(error => {
                    console.error('Error processing paste event:', error);
                });
            }
        }
    }, true); // 设置为捕获阶段


    // 防止默认浏览器处理文件拖放
    quill.root.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    // 存储 Quill 实例
    quillInstances.set(editorId, quill);
    console.log(`Quill initialized successfully with theme: ${theme}.`);
}

/**
 * 选择本地图片并上传
 * @param {Quill} quill - Quill 实例
 * @param {DotNetObjectReference} dotNetHelper - Blazor 对象引用
 */
function selectLocalImageWithBase64(quill, dotNetHelper) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const range = quill.getSelection();
                quill.insertEmbed(range.index, 'image', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };
}
/**
 * 选择本地图片并上传
 * @param {Quill} quill - Quill 实例
 * @param {DotNetObjectReference} dotNetHelper - Blazor 对象引用
 */
async function selectLocalImageWithUpload(quill, dotNetHelper,imageAPI) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            await uploadImage(quill, file, imageAPI);
        }
    };
}

/**
 * 上传图片到服务器并插入图片 URL
 * @param {Quill} quill - Quill 实例
 * @param {File} file - 要上传的图片文件
 * @param {string} imageAPI -图片上传的API地址，默认为‘/api/upload/image’
 */
async function uploadImage(quill, file,imageAPI) {
    const formData = new FormData();
    formData.append('image', file);

    try {
        //console.log(imageAPI);
        const response = await fetch(imageAPI, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const imageUrl = await response.text();
            const range = quill.getSelection();
            quill.insertEmbed(range.index, 'image', imageUrl);
        } else {
            console.error('Image upload failed.');
            alert('图片上传失败。');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('图片上传出错。');
    }
}

/**
 * 插入视频
 * @param {Quill} quill - Quill 实例
 * @param {DotNetObjectReference} dotNetHelper - Blazor 对象引用
 */
function insertVideo(quill, dotNetHelper) {
    const videoUrl = prompt('请输入视频 URL:');
    if (videoUrl) {
        quill.insertEmbed(quill.getSelection().index, 'video', videoUrl, Quill.sources.USER);
    }
}

/**
 * 获取编辑器的内容（HTML）
 * @param {string} editorId - 编辑器容器的 ID
 * @returns {string} - 编辑器内容的 HTML 字符串
 */
export function getEditorContent(editorId) {
    const quill = quillInstances.get(editorId);
    if (quill) {
        return quill.root.innerHTML;
    } else {
        console.error(`Quill instance for editor ID "${editorId}" not found.`);
        return "";
    }
}

/**
 * 获取编辑器的内容（Delta）
 * @param {string} editorId - 编辑器容器的 ID
 * @returns {string} - 编辑器内容的 Delta JSON 字符串
 */
export function getEditorDelta(editorId) {
    const quill = quillInstances.get(editorId);
    if (quill) {
        return JSON.stringify(quill.getContents());
    } else {
        console.error(`Quill instance for editor ID "${editorId}" not found.`);
        return JSON.stringify({ ops: [] });
    }
}

/**
 * 设置编辑器的内容（HTML）
 * @param {string} editorId - 编辑器容器的 ID
 * @param {string} content - 要设置的 HTML 内容
 */
export function setEditorContent(editorId, content) {
    const quill = quillInstances.get(editorId);
    if (quill) {
        quill.root.innerHTML = content;
    } else {
        console.error(`Quill instance for editor ID "${editorId}" not found.`);
    }
}

/**
 * 设置编辑器的内容（Delta）
 * @param {string} editorId - 编辑器容器的 ID
 * @param {string} deltaJson - 要设置的 Delta JSON 字符串
 */
export function setEditorDelta(editorId, deltaJson) {
    const quill = quillInstances.get(editorId);
    if (quill) {
        try {
            const delta = JSON.parse(deltaJson);
            quill.setContents(delta, 'silent');
        } catch (e) {
            console.error("Invalid Delta JSON string.");
        }
    } else {
        console.error(`Quill instance for editor ID "${editorId}" not found.`);
    }
}

/**
 * 释放 Quill 实例
 * @param {string} toolbarId - 工具栏容器的 ID
 * @param {string} editorId - 编辑器容器的 ID
 */
export function disposeEditor(toolbarId, editorId) {
    if (quillInstances.has(editorId)) {
        quillInstances.delete(editorId);
        console.log(`Quill instance for editor ID "${editorId}" disposed.`);
    } else {
        console.error(`Quill instance for editor ID "${editorId}" not found.`);
    }
}


/**
 * 重写粘贴图片上传
 * 
 * @param {ClipboardEvent} e - 粘贴事件
 * @param {Quill} q - Quill 实例
 * @param {string} imageAPI - 图片上传的 API 地址
 */
const overwriteParseImage = async (e, q, imageAPI) => {
    // 判断如果粘贴内容不为空，并且粘贴的是图片文件，则执行自定义逻辑
    if (e.clipboardData && (e.clipboardData.items || e.clipboardData.files)) {
        const items = e.clipboardData.items || e.clipboardData.files;
        // 图片格式正则，根据需要自行修改
        const IMAGE_MIME_REGEX = /^image\/(jpe?g|gif|png|svg|webp)$/i;
        // 阻止默认行为
        e.stopPropagation();
        e.preventDefault();
        // 遍历上传图片（图片可能是多张）
        for (let i = 0; i < items.length; i++) {
            if (IMAGE_MIME_REGEX.test(items[i].type)) {
                const file = items[i].getAsFile ? items[i].getAsFile() : items[i];
                if (file) {
                    try {
                        // 调用上传方法，获取图片 URL
                        const imageUrl = await uploadImage(q, file, imageAPI);
                        if (imageUrl) {
                            const range = q.getSelection();
                            q.insertEmbed(range.index, 'image', imageUrl, Quill.sources.USER);
                        }
                    } catch (error) {
                        console.error('Error uploading image:', error);
                        alert('图片上传出错。');
                    }
                }
            }
        }
    }
};