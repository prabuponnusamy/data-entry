

async function processTargets() {
    const websiteBaseUrl = getSelectedWebsiteBaseUrl();
    if (websiteBaseUrl == '') {
        alert('Please enter the website base URL. Eg https://abidear.com/employee');
        return;
    }
    resultMap = new Map();
    const targets = getAllowedTargets();
    for (const target of targets) {
        const targetUrl = buildTargetUrl(websiteBaseUrl, target);
        try {
            const response = await fetch(targetUrl);
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Extract values
            const inputFields = doc.querySelectorAll('input, textarea, select');
            //console.log('Input fields for target', target, ':', inputFields);
            // Find the panel body
            const panelBody = doc.querySelector(".panel-body");
            if (!panelBody) {
                console.warn('No panel body found for target', target);
                continue;
            }
            // Find the first row only
            const firstRow = panelBody.querySelector(".row");
            if (!firstRow) {
                console.warn('No row found in panel body for target', target);
                continue;
            }
            // Get all inputs, selects and textareas in the first row
            const fields = firstRow.querySelectorAll("input, select, textarea");

            const result = [];

            fields.forEach(field => {
                // Ignore hidden fields
                if (field.type === "hidden") return;

                if (field.name !== "supplier") return;

                // Collect relevant info about the field
                const info = {
                    tag: field.tagName.toLowerCase(),
                    type: field.tagName === "SELECT" ? "select" : field.type,
                    name: field.name,
                    id: field.id,
                    placeholder: field.placeholder || "",
                    required: field.required,
                    value: field.value
                };

                // If select, collect options
                if (field.tagName === "SELECT") {
                    info.options = [...field.options].map(option => ({
                        text: option.text,
                        value: option.value,
                        selected: option.selected
                    }));
                }

                result.push(info);
                resultMap.set(target, result);
            });
            //  console.log(result);
            //console.log('Fields for target', target, ':', result);
        } catch (error) {
            console.error('Error fetching/parsing target URL:', targetUrl, error);
        }
    }

    // All fetches are finished here
    console.log(resultMap);

    return resultMap;
}

async function getAllFields() {
    const resultMap = await processTargets();

    const keys = [...resultMap.keys()];
    if (!keys.length) return;

    const [firstKey, ...otherKeys] = keys;
    const firstFields = resultMap.get(firstKey);

    const commonFields = firstFields.filter(firstField =>
        otherKeys.every(key =>
            resultMap.get(key).some(field => isFieldEqual(firstField, field))
        )
    );

    const specificFieldsMap = new Map(
        keys.map(key => [
            key,
            resultMap.get(key).filter(field =>
                !commonFields.some(common => isFieldEqual(common, field))
            )
        ])
    );

    console.log("Common fields:", commonFields);
    console.log("Specific fields:", specificFieldsMap);

    // Generate HTML using resultMap 
    // Display as table | target1 | target2 | target3|
    /*
        tableHtml = `<table border="1"><tr>`;   
        for (const [target, fields] of resultMap.entries()) {
            // Create div with the target as id
            const targetDiv = document.createElement('div');

            // Create input fields HTML
            const fieldsHtml = generateInputFieldsHtml(fields);
            tableHtml += `<td><h4>${target}</h4>${fieldsHtml}</td>`;
        }
        tableHtml += `</tr></table>`;
    */
    // Filter supplier field
    var supplierField;
    var optionsHtml;
    for(var i = 0; i < commonFields.length; i++) {
        field = commonFields[i];
        console.log(field.name)
        if (field.name === "supplier") {
            supplierField = field;
            optionsHtml = field.options.map(option => `
                <option value="${option.value}" ${option.selected ? 'selected' : ''}>${option.text}</option>
            `).join('');
        }
    }
    if (optionsHtml) {
        var supplierHtml = `
            <select id="supplier" class="medium-input">
                ${optionsHtml}
            </select>
        `;
        document.getElementById('target-page-input').innerHTML = supplierHtml;
        // Select websiteBaseUrlSelect value to websiteBaseUrlInput
        document.getElementById('supplier').addEventListener('change', (event) => {
            console.log(event)
            var options = Array.from(document.getElementById('supplier')).filter(o => o.value == event.target.value)
            const selectedValue = event.target.value;
            console.log(options[0].text);
            document.getElementById('supplierId').value = options[0].text;
        });
    }
}

function isFieldEqual(field1, field2) {
    options1 = field1.options || [];
    options2 = field2.options || [];
    if (options1.length !== options2.length) {
        return false;
    }
    return field1.tag === field2.tag &&
        field1.type === field2.type &&
        field1.name === field2.name &&
        field1.id === field2.id &&
        field1.value === field2.value &&
        (field1.options || []).every((option1, index) => {
            const option2 = field2.options[index];
            return option1.text === option2.text &&
                option1.value === option2.value &&
                option1.selected === option2.selected;
        });
}

function generateInputFieldsHtml(fields) {
    return fields.map(field => {
        if (field.tag === "select") {
            const optionsHtml = field.options.map(option => `
                <option value="${option.value}" ${option.selected ? 'selected' : ''}>${option.text}</option>
            `).join('');
            return `
                <select name="${field.name}" id="${field.id}" ${field.required ? 'required' : ''}>
                    ${optionsHtml}
                </select>
            `;
        } else {
            return `
                <input type="${field.type}" name="${field.name}" id="${field.id}" placeholder="${field.placeholder}" value="${field.value}" ${field.required ? 'required' : ''} />
            `;
        }
    }).join('<br/>');
}