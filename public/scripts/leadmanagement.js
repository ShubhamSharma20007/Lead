



// remove the underscore from the

const info = document.querySelectorAll('.info');
info.forEach(element => {
    element.innerHTML = element.innerHTML.replace("_", " ");
})

function allowDrop(ev) {

    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.dataTransfer.setData("containerId", ev.target.parentElement.id);
}

async function drop(ev) {
    ev.preventDefault();

    var data = ev.dataTransfer.getData("text");
    var draggedElement = document.getElementById(data);
    var target = ev.target.closest('.board-item');
    var container = ev.target.closest('.board-column-content');

    if (target) {
        var rect = target.getBoundingClientRect();
        var mouseY = ev.clientY;
        var isBelow = mouseY > rect.top + rect.height / 2;

        if (isBelow) {
            container.insertBefore(draggedElement, target.nextElementSibling);
        } else {
            container.insertBefore(draggedElement, target);
        }
    } else {
        container.appendChild(draggedElement);
    }

    var leadId = draggedElement.getAttribute('data-lead-id');
    var fieldName = ev.target.closest('.board-column').querySelector('.board-column-header').getAttribute('data-target-status');

    fetch(`/updateLeadStatus/${leadId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fieldName: fieldName })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update lead status');
            }
            window.location.reload();
        })
        .catch(error => {
            console.error('Error updating lead status:', error);
        });
}



function findContainerId(element) {
    // Traverse up the DOM tree until finding an element with an ID
    while (element && !element.id) {
        element = element.parentNode;
    }
    return element ? element.id : null;
}



// custom field functionlity

// Function to fetch containers
async function fetchContainers() {
    try {
        const res = await fetch('/fetchcontainers'); // Fetch containers from database
        if (res.ok) {
            const data = await res.json();
            return data.containers; // Assuming the response contains an array of containers
        } else {
            throw new Error('Failed to fetch containers');
        }
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Function to render containers
async function renderContainers() {
    const containers = await fetchContainers();
    const container = document.querySelector('.slide-container');
    containers.forEach(containerData => {
        const newColumn = document.createElement('div');
        newColumn.classList.add('board-column', 'todo');
        newColumn.id = containerData.containerId;
        newColumn.dataset.containerId = containerData.containerId;
        newColumn.setAttribute('ondrop', 'drop(event)');
        newColumn.setAttribute('ondragover', 'allowDrop(event)');
        newColumn.innerHTML = `
            <div class="board-column-container">
                <div class="board-column-header" data-target-status="${containerData.fieldName}">${containerData.fieldName}(0)</div>
                <div class="board-column-content-wrapper">
                    <div class="board-column-content">
                    
                    </div>
                </div>
            </div>
        `;
        container.appendChild(newColumn);

        // Counter for the number of cards in this container
        let cardCount = 0;

        // Check if containerData is not one of the default containers
        if (containerData.fieldName !== 'New Lead' && containerData.fieldName !== 'Contact Initiation' && containerData.fieldName !== 'Schedule Follow Up') {
            // Fetch data for the current containerData.fieldName from the server
            fetch(`/fetchDataForContainer/${encodeURIComponent(containerData.fieldName)}`)
                .then(response => response.json())
                .then(data => {
                    console.log('Fetched data for', containerData.fieldName, ':', data);
                    if (data && Array.isArray(data)) {
                        data.forEach(item => {
                            const card = document.createElement('div');
                            card.classList.add('board-item');
                            card.draggable = true;
                            card.setAttribute('ondragstart', 'drag(event)');
                            card.id = `card_${item.Id}`;
                            card.dataset.leadId = item.Id;

                            const content = document.createElement('div');
                            content.classList.add('board-item-content');

                            const plan = document.createElement('div');
                            plan.classList.add('plan');

                            const inner = document.createElement('div');
                            inner.classList.add('inner');

                            const pricing = document.createElement('span');
                            pricing.classList.add('pricing');
                            pricing.innerHTML = `<span><small><i class="ri-file-add-line"></i></small></span>`;

                            inner.appendChild(pricing);

                            // Populate card with data values
                            const dataKeys = ['Id', 'lead_name', 'companyName', 'number', 'email', 'lead_status', 'target_status'];
                            dataKeys.forEach(key => {
                                const info = document.createElement('p');
                                info.classList.add('info');
                                info.style.fontSize = '13px';
                                info.textContent = `${key}: ${item[key]}`;
                                inner.appendChild(info);
                            });

                            plan.appendChild(inner);
                            content.appendChild(plan);
                            card.appendChild(content);
                            newColumn.querySelector('.board-column-content').appendChild(card);

                            // Increment the card count for this container
                            cardCount++;
                        });

                        // Update the column header with the card count
                        newColumn.querySelector('.board-column-header').textContent = `${containerData.fieldName}(${cardCount})`;
                    } else {
                        console.error(`Data for ${containerData.fieldName} is not valid.`);
                    }
                })
                .catch(error => console.error(`Error fetching data for ${containerData.fieldName}:`, error));
        }
    });
}


// Function to add a new field
async function addField() {
    const value = prompt('Please Enter the field name', 'Ex. New Field');
    try {
        const res = await fetch('/customfield', {
            headers: {
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({ value })
        });
        if (res.ok) {
            await renderContainers();
        } else {
            throw new Error('Failed to add field');
        }
    } catch (error) {
        console.error(error);
    }
}

// Event listener to add a new field
function AddField() {
    const addFieldBtn = document.querySelector('.addFieldBtn');
    addFieldBtn.addEventListener('click', addField);
}

// Initial render
renderContainers();
AddField();

