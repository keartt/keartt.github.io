const textBackgroundColor = 'rgba(255, 255, 255, 0.7)';
const textColor = '#000000';

// labelConfigs 객체 수정
const labelConfigs = {
    person: {
        id: 0,
        displayName: '사람',
        strokeColor: '#FF0000',
    },
    car: {
        id: 1,
        displayName: '자동차',
        strokeColor: '#00FF00',
    },
    bicycle: {
        id: 2,
        displayName: '자전거',
        strokeColor: '#0000FF',
    },
    dog: {
        id: 999,
        displayName: '강아지',
        strokeColor: '#FFA500',
    },
    cat: {
        id: 4,
        displayName: '고양이',
        strokeColor: '#800080',
    }
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const labelingToggle = document.getElementById('labelingToggle');
const labelTextToggle = document.getElementById('labelTextToggle');
const labelSelect = document.getElementById('labelSelect');

let currentImage = null;
let boxes = [];
let isDrawing = false;
let startX, startY;
let selectedLabel = '';
let activeBox = null;
let isDragging = false;
let isResizing = false;
let dragOffsetX, dragOffsetY;
let isLabelingMode = false;
let showLabelText = true;
let labelVisibility = {};

// 새로운 변수 추가
let SCALE = 1;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// 줌 컨트롤 요소
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const zoomLevelDisplay = document.getElementById('zoomLevel');

// 이미지 이동을 위한 변수 추가
let centerX = -30;
let centerY = 20;
const PAN_STEP = 50; // 한 번에 이동할 픽셀 수

// 최초 이미지 로드
let img = new Image();
img.onload = () => {
    // 모든 데이터 초기화
    boxes = [];
    activeBox = null;
    labelVisibility = {};

    currentImage = img;
    canvas.width = 640;
    canvas.height = 640;
    // 이미지 비율 유지하면서 640x640에 맞추기


    const scale = Math.min(640 / img.width, 640 / img.height);
    currentImage.width = img.width * scale;
    currentImage.height = img.height * scale;

    // 시작시 라벨 선택
    selectedLabel = document.getElementById('labelSelect').value;

    // 라벨 모드 on
    isLabelingMode = true;

    // 캔버스와 관련 UI 업데이트
    drawCanvas();
    updateLabelList();
    updateLabelVisibilityControls();
};
img.src = './img.png'

// 최초 텍스트 로드
fetch('./test.txt') // 서버에 있는 ./label.txt 파일을 가져옴
    .then(response => {
        if (!response.ok) {
            throw new Error('파일을 불러오는 데 실패했습니다.');
        }
        return response.text();
    })
    .then(content => {
        const blob = new Blob([content], { type: 'text/plain' });
        readTxt(blob); // 읽은 파일을 readTxt 함수에 전달
    })
    .catch(error => {
        console.error(error);
        alert('파일을 읽는 데 문제가 발생했습니다.');
    });

// 이미지 업로드
document.getElementById('fileInput').onchange = (e) => {
    // updateZoom(1);
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
};

// 라벨링 토글 버튼
labelingToggle.onclick = () => {
    isLabelingMode = labelingToggle.checked;  // 체크박스 상태에 맞춰 isLabelingMode 업데이트

    if (isLabelingMode) {
        activeBox = null;
        drawCanvas();
        updateLabelList();
    }
};

// 라벨 텍스트 토글 버튼
labelTextToggle.onclick = () => {
    showLabelText = labelTextToggle.checked;  // 체크박스 상태에 맞춰 isLabelingMode 업데이트
    drawCanvas();
};

// 라벨 선택
labelSelect.onchange = (e) => {
    selectedLabel = e.target.value;
};

// 마우스 이벤트
canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / SCALE;
    const mouseY = (e.clientY - rect.top) / SCALE;

    if (!isLabelingMode) {
        if (activeBox) {
            if (isOverResizeHandle(mouseX, mouseY)) {
                isResizing = true;
                return;
            }
            if (isOverBox(mouseX, mouseY)) {
                isDragging = true;
                dragOffsetX = mouseX - activeBox.x;
                dragOffsetY = mouseY - activeBox.y;
                return;
            }
        }
        return;
    }

    startX = mouseX;
    startY = mouseY;
    isDrawing = true;
};

canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / SCALE;
    const mouseY = (e.clientY - rect.top) / SCALE;

    if (!isLabelingMode) {
        if (isDragging && activeBox) {
            activeBox.x = mouseX - dragOffsetX;
            activeBox.y = mouseY - dragOffsetY;
            drawCanvas();
        } else if (isResizing && activeBox) {
            activeBox.width = mouseX - activeBox.x + centerX;
            activeBox.height = mouseY - activeBox.y + centerY;
            drawCanvas();
        }
    } else if (isDrawing) {
        drawCanvas();
        ctx.strokeStyle = labelConfigs[selectedLabel].strokeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX * SCALE, startY * SCALE, mouseX * SCALE - startX * SCALE, mouseY * SCALE - startY * SCALE);
    }

    updateCursor(mouseX, mouseY);
};

canvas.onmouseup = (e) => {
    if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
    } else if (isDrawing) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / SCALE;
        const y = (e.clientY - rect.top) / SCALE;

        if (selectedLabel && Math.abs(x - startX) > 5 && Math.abs(y - startY) > 5) {
            // 실제 남겨질 사각형 그리는 곳
            boxes.push({
                // 그릴 때 드래그 한 값으로 그대로 그리기 때문에 cx, xy 제외
                // cx, cy 로 x y 수정은 기존에 그려진 값들만 수정
                x: Math.min(startX, x) + centerX,
                y: Math.min(startY, y) + centerY,
                width: Math.abs(x - startX),
                height: Math.abs(y - startY),
                label: selectedLabel
            });
            updateLabelVisibilityControls();
        }
    }
    isDrawing = false;
    drawCanvas();
    updateLabelList();
};


// 방향 버튼 이벤트 리스너
document.getElementById('moveUp').onclick = () => moveImage('up');
document.getElementById('moveDown').onclick = () => moveImage('down');
document.getElementById('moveLeft').onclick = () => moveImage('left');
document.getElementById('moveRight').onclick = () => moveImage('right');

// 줌 버튼 이벤트
zoomIn.onclick = () => updateZoom(SCALE + ZOOM_STEP);
zoomOut.onclick = () => updateZoom(SCALE - ZOOM_STEP);
canvas.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) {
        updateZoom(SCALE + ZOOM_STEP);  // 줌 인
    }
    else if (e.deltaY > 0) {
        updateZoom(SCALE - ZOOM_STEP);  // 줌 아웃
    }
    e.preventDefault();
});


// 저장
document.getElementById('saveBtn').onclick = () => {
    const yoloData = boxes.map(box => {
        const centerX = (box.x + box.width / 2) / canvas.width;
        const centerY = (box.y + box.height / 2) / canvas.height;
        const width = box.width / canvas.width;
        const height = box.height / canvas.height;
        const labelId = labelConfigs[box.label].id;
        return `${labelId} ${centerX} ${centerY} ${width} ${height}`;
    }).join('\n');

    const blob = new Blob([yoloData], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labels.txt';
    a.click();
};

// txt 파일 처리
document.getElementById('txtFileInput').onchange = (e) => {
    if (!e.target.files.length) return;

    const file = e.target.files[0];
    readTxt(file);

    // 모든 체크박스 체크하기
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
    });

};


// 라벨 가시성 컨트롤 업데이트
function updateLabelVisibilityControls() {
    const container = document.getElementById('labelVisibilityControls');
    const usedLabels = new Set(boxes.map(box => box.label));

    // 기존 상태 저장
    const previousControls = {};
    container.querySelectorAll('input').forEach(input => {
        previousControls[input.dataset.label] = input.checked;
    });

    // 컨테이너 초기화
    container.innerHTML = '';

    // 사용된 라벨에 대해서만 체크박스 생성
    usedLabels.forEach(label => {
        const config = labelConfigs[label];
        var checkedStatus = previousControls[label] !== undefined ? previousControls[label] : true;
        labelVisibility[label] = checkedStatus;

        container.innerHTML += `
            <label class="toggle-switch">
                <input type="checkbox" data-label="${label}" ${checkedStatus ? 'checked' : ''}>
                <span class="toggle-slider round"></span>
                <span class="color-box" style="background: ${config.strokeColor}"></span>
                ${config.displayName}
            </label>
        `

    });
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.onchange = (e) => {
            const label = e.target.dataset.label;
            labelVisibility[label] = e.target.checked;
            drawCanvas();
        };
    });
}

// 라벨 목록 업데이트
function updateLabelList() {
    const labelListPanel = document.getElementById('labelListPanel');

    labelListPanel.innerHTML = '';  // 기존 내용을 비우기

    boxes.forEach((box, index) => {
        const labelItem = document.createElement('div');
        labelItem.className = `label-item ${box === activeBox ? 'active' : ''}`;

        // 박스 선택 이벤트
        labelItem.addEventListener('click', () => selectBox(index, box === activeBox));
        labelItem.innerHTML = `
                    <span>${labelConfigs[box.label].displayName}</span>
                    <div>
                        <span class="copy-btn" >복사</span>
                        <span class="delete-btn" ">×</span>
                    </div>`;

        // 복사와 삭제 버튼의 이벤트를 별도로 추가
        labelItem.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyBox(index);
        });
        labelItem.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBox(index);
        });

        labelListPanel.appendChild(labelItem);
    });
}

// 박스 복사
function copyBox(index) {
    const originalBox = boxes[index];
    const newBox = {
        ...originalBox,
        x: originalBox.x + 20,
        y: originalBox.y + 20
    };

    boxes.push(newBox);

    // 새로운 박스의 인덱스로 selectBox 호출
    const newIndex = boxes.length - 1;
    selectBox(newIndex, false);

    isLabelingMode = false;
    labelingToggle.checked = false;

    drawCanvas();
    updateLabelList();
}

// 박스 선택
function selectBox(index, isActive) {
    if (isActive) {
        activeBox = null;
    } else {
        isLabelingMode = false;
        labelingToggle.checked = false;
        activeBox = boxes[index];
    }

    drawCanvas();
    updateLabelList();
}

// 박스 삭제
function deleteBox(index) {
    boxes.splice(index, 1);
    activeBox = null;
    drawCanvas();
    updateLabelList();
    updateLabelVisibilityControls();
}

// 이동 가능여부 확인
function isOverBox(x, y) {
    x += centerX;
    y += centerY;
    var okX = Math.min(activeBox.x, activeBox.x + activeBox.width) <= x
        && x <= Math.max(activeBox.x, activeBox.x + activeBox.width);
    var okY = Math.min(activeBox.y, activeBox.y + activeBox.height) <= x
        && x <= Math.max(activeBox.y, activeBox.y + activeBox.height);
    // var okY = activeBox.height >= 0 ?
    //     (y >= activeBox.y && y <= activeBox.y + activeBox.height)
    //     : (y >= activeBox.y +activeBox.height && y <= activeBox.y);

    return activeBox && okX &&  okY
}

// 크기조정여부 확인
function isOverResizeHandle(x, y) {
    if (!activeBox) return false;
    x += centerX;
    y += centerY;
    const handleX = activeBox.x + activeBox.width - 4;
    const handleY = activeBox.y + activeBox.height - 4;
    return x >= handleX - 4 && x <= handleX + 4 &&
        y >= handleY - 4 && y <= handleY + 4;
}

// 커서변경
function updateCursor(x, y) {
    if (!isLabelingMode && activeBox) {
        if (isOverResizeHandle(x, y)) {
            canvas.style.cursor = 'nwse-resize';
        } else if (isOverBox(x, y)) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    } else if (isLabelingMode) {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
}

// 우측하단 크기조정 캔버스
function drawResizeHandle(box) {
    // 선택된 박스의 라벨 설정 가져오기
    const activeBoxLabel = boxes.find(b => b === activeBox)?.label;

    ctx.fillStyle = labelConfigs[activeBoxLabel].strokeColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const handleSize = 8;
    ctx.fillRect(
        box.x + box.width - handleSize / 2,
        box.y + box.height - handleSize / 2,
        handleSize,
        handleSize
    );
    ctx.strokeRect(
        box.x + box.width - handleSize / 2,
        box.y + box.height - handleSize / 2,
        handleSize,
        handleSize
    );
}

// 줌 업데이트
function updateZoom(newScale) {
    SCALE = Math.min(Math.max(newScale, MIN_ZOOM), MAX_ZOOM);
    zoomLevelDisplay.textContent = `${Math.round(SCALE * 100)}%`;
    drawCanvas();
}

// 이미지 이동
function moveImage(direction) {
    switch (direction) {
        case 'up':
            centerY -= PAN_STEP;
            break;
        case 'down':
            centerY += PAN_STEP;
            break;
        case 'left':
            centerX -= PAN_STEP;
            break;
        case 'right':
            centerX += PAN_STEP;
            break;
    }

    // 캔버스 위치 업데이트
    drawCanvas();
}

// 메인
function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImage) {
        // 스케일 적용
        ctx.save();
        ctx.scale(SCALE, SCALE);

        ctx.translate(-centerX, -centerY);


        ctx.drawImage(currentImage, 0, 0);
        ctx.restore();

        boxes.forEach(box => {
            if (labelVisibility[box.label] !== false) {
                // ... existing box drawing code ...
                // 스케일 적용
                let scaledX = (box.x - centerX) * SCALE ;
                let scaledY = (box.y - centerY) * SCALE;
                let scaledWidth = box.width * SCALE;
                let scaledHeight = box.height * SCALE;

                const config = labelConfigs[box.label];
                const isActive = box === activeBox;

                if (isActive) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
                    ctx.strokeStyle = config.strokeColor;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

                    drawResizeHandle({
                        x: scaledX,
                        y: scaledY,
                        width: scaledWidth,
                        height: scaledHeight
                    });
                } else {
                    ctx.strokeStyle = config.strokeColor;
                    ctx.lineWidth = 2;
                    // 우측하단 선택자가 다른 위치로 이동했을경우
                    if (box.width < 0) {
                        box.x += box.width;
                        scaledX = (box.x - centerX) * SCALE;
                        box.width = -box.width;
                        scaledWidth = box.width * SCALE;
                    }
                    if (box.height < 0) {
                        box.y += box.height;
                        scaledY = (box.y - centerY) * SCALE;
                        box.height = -box.height;
                        scaledHeight = box.height * SCALE;
                    }
                    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }

                ctx.fillStyle = config.strokeColor + '1A';
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

                if (showLabelText) {
                    // 텍스트 배경 크기와 위치 확대/축소 적용
                    const tw = Math.max((20*config.displayName.length) * SCALE, 40)  // 텍스트 배경 크기
                    const th = 20 * SCALE; // 텍스트 배경 높이
                    const tx = scaledX + 5 * SCALE;  // 텍스트 x 위치
                    const ty = scaledY - 5 * SCALE;  // 텍스트 y 위치

                    // 텍스트 배경 그리기
                    ctx.fillStyle = textBackgroundColor;
                    ctx.fillRect(scaledX, scaledY - th, tw, th);

                    // 텍스트 그리기
                    ctx.fillStyle = textColor;
                    ctx.font = `bold ${13 * SCALE}px Pretendard`;  // 폰트 크기 확대
                    ctx.fillText(config.displayName, tx, ty);  // 텍스트 위치 확대
                }
            }
        });
    }
}

// txt 파일 읽기
function readTxt(blob) {
    const reader = new FileReader();
    reader.onload = (event) => {
        // empty
        if (!event.target.result.trim()) return fail();

        // 박스와 선택 상태 초기화
        boxes = [];
        activeBox = null;

        // 모든 라벨의 가시성을 true로 강제 설정
        labelVisibility = {};
        Object.keys(labelConfigs).forEach(label => {
            labelVisibility[label] = true;
        });

        const content = event.target.result;
        const lines = content.split('\n');
        let isAvailable = false; // check Availability

        lines.forEach(line => {
            if (line.trim() === '') return;

            const [labelId, cx, cy, width, height] = line.split(' ').map(Number);

            if (isNaN(labelId) || isNaN(cx) || isNaN(cy) || isNaN(width) || isNaN(height)) {
                // 잘못된 형식의 라인
                return;
            }

            const labelKey = Object.keys(labelConfigs).find(
                key => labelConfigs[key].id === labelId
            );

            if (labelKey) {
                isAvailable = true;
                boxes.push({
                    x: (cx - width / 2) * currentImage.width,
                    y: (cy - height / 2) * currentImage.height,
                    width: width * currentImage.width,
                    height: height * currentImage.height,
                    label: labelKey
                });
            }
        });

        // do nothing
        if (!isAvailable) return fail();

        // UI 업데이트
        drawCanvas();
        updateLabelList();
        updateLabelVisibilityControls();
    };

    reader.readAsText(blob);

    function fail() {
       alert('something worng file')
    }

}
