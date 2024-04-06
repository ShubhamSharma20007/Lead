



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

    var xhr = new XMLHttpRequest();
    xhr.open('PUT', `/updateLeadStatus/${leadId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {

            } else {
                console.error('Error updating lead status:', xhr.statusText);
            }
        }
    };

    xhr.send(JSON.stringify({ fieldName: fieldName }));
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
               <div class="d-flex align-items-center justify-content-evenly ">
               <div class="board-column-header" data-target-status="${containerData.fieldName}">${containerData.fieldName}(0)</div>
               <i class="ri-add-circle-line  h5 addFieldBtn  m-0  text-dark" style="cursor: pointer;"></i>
               </div>
                <div class="board-column-content-wrapper">
                    <div class="board-column-content">
                        <div class="board-item" data-lead-id=""></div> <!-- Set draggable attribute and ondragstart event handler here -->
                    </div>
                </div>
            </div>
        `;
        container.appendChild(newColumn);

       // Counter for the number of cards in this container
       let cardCount = 0;
       const addField = async (fieldName, previousField) => {
           const newFieldName = prompt('Enter field name:');
           if (newFieldName !== null && newFieldName.trim() !== '') {
               try {
                   const response = await fetch('/customfield', {
                       method: 'POST',
                       headers: {
                           'Content-Type': 'application/json'
                       },
                       body: JSON.stringify({ value: newFieldName, previousField })
                   });
                   const data = await response.json();
                   console.log('Field added successfully:', data);
                   location.reload();
               } catch (error) {
                   console.error('Error adding field:', error);
               }
           }
       };

       // Event listener for the "Add Field" button
       newColumn.querySelector('.addFieldBtn').addEventListener('click', function() {
           const fieldName = this.dataset.fieldName; // Get the corresponding field name
           const previousField = this.closest('.board-column').querySelector('.board-column-header').dataset.targetStatus; // Get the previous field name
           addField(fieldName, previousField);
       });

        // Fetch data for the current containerData.fieldName from the server
        fetch(`/fetchDataForContainer/${encodeURIComponent(containerData.fieldName)}`)
            .then(response => response.json())
            .then(data => {
                console.log('Fetched data for', containerData.fieldName, ':', data);
                if (data && Array.isArray(data)) {
                    const boardItem = newColumn.querySelector('.board-item'); // Select the board-item div
                    data.forEach(item => {

                        const card = document.createElement('div');

                        card.classList.add('cookie-card');
                        card.draggable = true;
                        card.setAttribute('ondragstart', 'drag(event)');
                        card.id = `card_${item.Id}`;
                        card.dataset.leadId = item.Id;

                        card.innerHTML = `
                        <div class="activity_sec position-absolute  bg-white mt-1 border">
                        <div class="coolinput">
                    
                        <input type="text" value='${item.Id}' hidden name='lead_id'>
                        <input type="text" placeholder="Write here..." name="activity" class=" activity input" style="width: 100%;">
                        </div>
                        <div class="btns_sec">
                          <button class="sub_btn ">  
                              Submit         
                          </button>
                           <button type="reset" class="cen_btn ">
                              Cancel                                  
                          </button>
                        </div>
                      </div>

                      <div class="activity_data  ">
                      <div class=" w-100 px-3 py-1 ">
                      
                    </div>
                        `
                        // Fetch activities for this lead ID and update the card
                        fetch(`/activities/${item.Id}`)
                            .then(response => response.json())
                            .then(activities => {
                                if (activities && activities.length > 0) {
                                    activities.forEach(activity => {
                                        const activityData = document.createElement('div');
                                        activityData.classList.add('activity-data');
                                        activityData.style.padding = '6px'
                                        activityData.innerHTML = `
                  <input type="text" value='${item.Id}' hidden class='fetchDataByLeadId' data-lead-id='${item.Id}'>
                  <small class="created-at">${new Date(activity.createdAt).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                        })}</small>
                  <div class="acti-name">
                      <small class="activity">${activity.activity}</small>
                  </div>
                  <div class='line'></div>
              `;
                                        card.querySelector('.activity_data').appendChild(activityData);
                                    });
                                }
                            })
                            .catch(error => console.error(`Error fetching activities for lead ID ${item.Id}:`, error));

                        // Create card content

                        const title = document.createElement('span');
                        const newspan = document.createElement('span');

                        title.classList.add('d-block', 'title', 'text-capitalize');
                        title.textContent = item.companyName;
                        title.setAttribute('onclick', 'showLeadData(this)');
                        newspan.innerHTML = `<i class="ri-information-2-fill float-end"></i>`;
                        newspan.onclick = function(){
                            openActivityData(card)
                        }
                        title.appendChild(newspan);

                        const companyName = document.createElement('small');
                        companyName.textContent = item.companyName;

                        const leadStatus = document.createElement('small');
                        leadStatus.textContent = item.Amount;

                        const actions = document.createElement('div');

                        actions.classList.add('actions');

                        const activityButton = document.createElement('button');

                        activityButton.classList.add('pref');
                        activityButton.textContent = 'Activity';
                        activityButton.onclick = function() {
                            openActivity(card);
                        };

                        const icons = document.createElement('div');
                        icons.innerHTML = `
                            <button class="accept">
                            <a style="text-decoration: noen; color:white" href="mailto:${item.email}">
                            <i class="ri-mail-line"></i>
                        </a>
                                </button>
                            <button class="accept">
                            <a style="text-decoration: noen; color:white"  href="tel:${item.contactNumber}">
                            <i class="ri-phone-line"></i>
                        </a>
                                </button>
                            <button class="accept call_icon">
                            <a style="text-decoration: none; color:white" href="https://wa.me/${item.contactNumber}" >
                            <i class="ri-chat-3-fill"></i>
                        </a>                            </button>
                        `;


                        actions.appendChild(activityButton);
                        actions.appendChild(icons);


                        card.appendChild(title);
                        card.appendChild(companyName);
                        card.appendChild(leadStatus);
                        card.appendChild(actions);


                        boardItem.appendChild(card); // Append card to the board-item
                        const createdAt = document.createElement('small');
                        const createdAtDate = new Date(item.createdAt);
                        const now = new Date();

                        const diffMs = now - createdAtDate;
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                        if (diffDays === 0) {
                            createdAt.textContent = "Today";
                        }
                        else if (diffDays === 1) {
                            createdAt.textContent = "Yesterday";
                        }
                        else {
                            createdAt.textContent = createdAtDate.toLocaleString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                        }


                        createdAt.style.fontSize = '70%'
                        card.appendChild(createdAt);

                        // Increment the card count for this container
                        cardCount++;
                    });

                    // Update the column header with the card count
                    newColumn.querySelector('.board-column-header').textContent = `${containerData.fieldName}(${cardCount})`;

                    // Set data-lead-id attribute of board-item to the first card's lead ID
                    if (data.length > 0) {
                        boardItem.dataset.leadId = data[0].Id;
                    }

                    // Add contact card
                    const contactCard = document.createElement('div');
                    contactCard.classList.add('contact-cards');
                    contactCard.innerHTML = `
                        <div class="d-flex justify-content-center align-items-center gap-2 h-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-telephone" viewBox="0 0 16 16">
                                <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z" />
                            </svg>
                            <small>${containerData.number}</small>
                        </div>
                    `;
                    newColumn.querySelector('.board-column-content').appendChild(contactCard);
                } else {
                    console.error(`Data for ${containerData.fieldName} is not valid.`);
                }
            })
            .catch(error => console.error(`Error fetching data for ${containerData.fieldName}:`, error));
    });
}



function openActivity(value) {
    const activity_container = value.querySelector(".activity_sec")
    activity_container.classList.toggle("d-block")

  }
  function openActivityData(value) {
    const activity_data = value.querySelector('.activity_data')
    activity_data.classList.toggle("d-block")
  
  
  }


// Add event listener to submit button
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('sub_btn')) {
        const cardElement = event.target.closest('.cookie-card');
        const leadId = cardElement.dataset.leadId;
        const activityInput = cardElement.querySelector('.activity');
        const activity = activityInput.value.trim();

        // Send AJAX request to server
        fetch('/activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lead_id: leadId,
                activity: activity
            })
        })
            .then(response => response.json())
            .then(data => {
                // Handle response as needed
                console.log('Response from server:', data);
                // Show alert
                alert('Data posted successfully!');
                // Clear activity field
                activityInput.value = '';
            })
            .catch(error => {
                console.error('Error sending data to server:', error);
                // Handle error
            });
    }
});









// // Function to add a new field
// async function addField() {
//     const value = prompt('Please Enter the field name', 'Ex. New Field');
//     try {
//         const res = await fetch('/customfield', {
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             method: "POST",
//             body: JSON.stringify({ value })
//         });
//         if (res.ok) {
//             await renderContainers();
//         } else {
//             throw new Error('Failed to add field');
//         }
//     } catch (error) {
//         console.error(error);
//     }
// }

// // Event listener to add a new field
// function AddField() {
//     const addFieldBtn = document.querySelector('.addFieldBtn');
//     addFieldBtn.addEventListener('click', addField);
// }




// Initial render
renderContainers();
// AddField();

