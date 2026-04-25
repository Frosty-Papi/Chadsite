function getCSRF(){return document.querySelector('meta[name="csrf-token"]')?.content||""}

function escapeHtml(value){
    return String(value ?? "").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

function ensureOtpPanel(){
    let panel=document.getElementById("otp-panel");
    if(panel)return panel;

    const form=document.getElementById("create-user-form");
    panel=document.createElement("div");
    panel.id="otp-panel";
    panel.className="otp-panel hidden";
    panel.innerHTML=`
        <div class="otp-header">One-Time Password</div>
        <div id="otp-value" class="otp-value"></div>
        <button type="button" id="copy-otp">Copy</button>
        <div class="otp-warning">This password will not be shown again. Copy it before leaving or refreshing this page.</div>
    `;
    form?.insertAdjacentElement("afterend",panel);
    return panel;
}

function showOneTimePassword(password){
    const panel=ensureOtpPanel();
    const value=panel.querySelector("#otp-value");
    if(value)value.textContent=password||"";
    panel.classList.remove("hidden");
}

function updateStatus(row,status){
    const cell=row?.querySelector(".status-cell") || row?.children?.[2];
    if(cell)cell.textContent=status;
}

function bindRoleSelect(select){
    if(!select || select.dataset.bound)return;
    select.dataset.bound="1";
    select.addEventListener("change",async()=>{
        await api("/admin/user/role",{userId:select.dataset.id,role:select.value});
    });
}

function addUserRow(user){
    const table=document.getElementById("user-table");
    if(!table || !user)return;

    const tr=document.createElement("tr");
    tr.dataset.id=user.id;
    tr.dataset.name=String(user.username||"").toLowerCase();
    tr.innerHTML=`
        <td>${escapeHtml(user.username)}</td>
        <td>
            <select class="role-select" data-id="${escapeHtml(user.id)}">
                <option value="user" selected>User</option>
                <option value="admin">Admin</option>
            </select>
        </td>
        <td class="status-cell">Reset Required</td>
        <td class="actions-cell">
            <button type="button" class="disable-btn" data-id="${escapeHtml(user.id)}">Disable</button>
            <button type="button" class="enable-btn" data-id="${escapeHtml(user.id)}">Enable</button>
            <button type="button" class="reset-btn" data-id="${escapeHtml(user.id)}">Reset PW</button>
            <button type="button" class="force-reset-btn" data-id="${escapeHtml(user.id)}">Force Reset</button>
            <button type="button" class="delete-btn" data-id="${escapeHtml(user.id)}">Delete</button>
        </td>
    `;
    table.appendChild(tr);
    bindRoleSelect(tr.querySelector(".role-select"));
}

document.addEventListener("DOMContentLoaded",()=>{

    // tabs (FIXED active state)
    const tabButtons = document.querySelectorAll("[data-tab]");

    tabButtons.forEach(btn=>{
        btn.addEventListener("click",()=>{
            // hide all tabs
            document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));

            // remove active from all buttons
            tabButtons.forEach(b=>b.classList.remove("active"));

            // show selected tab
            document.getElementById("tab-"+btn.dataset.tab)?.classList.remove("hidden");

            // mark this button active
            btn.classList.add("active");
        });
    });

    // search filter
    const search=document.getElementById("search");
    if(search){
        search.addEventListener("input",()=>{
            const val=search.value.toLowerCase();
            document.querySelectorAll("#user-table tr").forEach(tr=>{
                const name=tr.dataset.name||"";
                tr.style.display=name.includes(val)?"":"none";
            });
        });
    }

    document.querySelectorAll(".role-select").forEach(bindRoleSelect);

    const userTable=document.getElementById("user-table");
    if(userTable){
        userTable.addEventListener("click",async e=>{
            const btn=e.target.closest("button[data-id]");
            if(!btn)return;

            const userId=btn.dataset.id;
            const row=btn.closest("tr");

            if(btn.classList.contains("disable-btn")){
                await api("/admin/user/disable",{userId,mode:"permanent"});
                updateStatus(row,"Disabled");
            }

            if(btn.classList.contains("enable-btn")){
                await api("/admin/user/enable",{userId});
                updateStatus(row,"Active");
            }

            if(btn.classList.contains("reset-btn")){
                const res=await api("/admin/user/reset-password",{userId});
                showOneTimePassword(res.password);
                updateStatus(row,"Reset Required");
            }

            if(btn.classList.contains("force-reset-btn")){
                await api("/admin/user/force-reset",{userId});
                updateStatus(row,"Reset Required");
            }

            if(btn.classList.contains("delete-btn")){
                if(!confirm("Delete this user?"))return;
                await api("/admin/user/delete",{userId});
                row?.remove();
            }
        });
    }

    const cu=document.getElementById("create-user-form");
    if(cu){
        ensureOtpPanel();
        cu.querySelector('input[name="password"]')?.remove();
        cu.addEventListener("submit",async e=>{
            e.preventDefault();
            const username=String(new FormData(cu).get("username")||"").trim();
            const res=await api("/admin/user",{username});
            showOneTimePassword(res.password);
            addUserRow(res.user);
            cu.reset();
        });
    }

    document.addEventListener("click",async e=>{
        if(e.target?.id!=="copy-otp")return;
        const text=document.getElementById("otp-value")?.textContent||"";
        if(!text)return;
        try{
            await navigator.clipboard.writeText(text);
            e.target.textContent="Copied";
            setTimeout(()=>{e.target.textContent="Copy"},1500);
        }catch{
            toast.error(text);
        }
    });

    const cs=document.getElementById("create-service-form");
    if(cs){
        cs.addEventListener("submit",async e=>{
            e.preventDefault();
            const data=Object.fromEntries(new FormData(cs));
            await api("/admin/service",data);
            location.reload();
        });
    }

});

document.addEventListener("click", async (e) => {

    const row = e.target.closest(".service-row");
    if (!row) return;

    // ENTER EDIT MODE
    if (e.target.classList.contains("edit-service-btn")) {
        const nameInput = row.querySelector(".edit-name");
        const pathInput = row.querySelector(".edit-path");
        const saveBtn = row.querySelector(".save-service-btn");

        function updateValidation() {
            const isValid = validateServiceRow(row);
            saveBtn.disabled = !isValid;
        }

        nameInput.addEventListener("input", updateValidation);
        pathInput.addEventListener("input", updateValidation);

        // run once initially
        updateValidation();

        row.querySelector(".view-mode").classList.add("hidden");
        row.querySelector(".service-edit").classList.remove("hidden");

        row.querySelector(".edit-service-btn").classList.add("hidden");
        row.querySelector(".save-service-btn").classList.remove("hidden");
        row.querySelector(".cancel-service-btn").classList.remove("hidden");
    }

    // CANCEL EDIT
    if (e.target.classList.contains("cancel-service-btn")) {
        row.querySelector(".view-mode").classList.remove("hidden");
        row.querySelector(".service-edit").classList.add("hidden");

        row.querySelector(".edit-service-btn").classList.remove("hidden");
        row.querySelector(".save-service-btn").classList.add("hidden");
        row.querySelector(".cancel-service-btn").classList.add("hidden");
    }

    // SAVE EDIT
    if (e.target.classList.contains("save-service-btn")) {
        const btn = e.target;
        const id = row.dataset.id;

        if (!validateServiceRow(row)) return;

        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            const res = await fetch("/admin/service/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": getCSRF()
                },
                body: JSON.stringify({
                    serviceId: id,
                    name: row.querySelector(".edit-name").value,
                                     path: row.querySelector(".edit-path").value,
                                     min_role: row.querySelector(".edit-role").value
                })
            });

            if (!res.ok) throw new Error();

            // update UI
            row.querySelector(".service-name").textContent = row.querySelector(".edit-name").value;
            row.querySelector(".service-path").textContent = row.querySelector(".edit-path").value;
            row.querySelector(".service-role").textContent = `(${row.querySelector(".edit-role").value})`;

            showToast("Service updated");

            // exit edit mode
            row.querySelector(".view-mode").classList.remove("hidden");
            row.querySelector(".service-edit").classList.add("hidden");

            row.querySelector(".edit-service-btn").classList.remove("hidden");
            row.querySelector(".save-service-btn").classList.add("hidden");
            row.querySelector(".cancel-service-btn").classList.add("hidden");

        } catch {
            showToast("Failed to update service", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Save";
        }
    }

    //DELETE SERVICE
    if (e.target.classList.contains("delete-service-btn")) {
        if (!confirm("Delete this service?")) return;

        try {
            await api("/admin/service/delete", { serviceId: row.dataset.id });
            row.remove();
            showToast("Service deleted");
        } catch {
            showToast("Delete failed", "error");
        }
    }

});

function validateServiceRow(row) {
    const nameInput = row.querySelector(".edit-name");
    const pathInput = row.querySelector(".edit-path");

    const nameError = row.querySelector(".name-error");
    const pathError = row.querySelector(".path-error");

    let valid = true;

    // --- NAME ---
    if (!nameInput.value.trim()) {
        nameError.textContent = "Name is required";
        nameInput.classList.add("invalid");
        nameInput.classList.remove("valid");
        valid = false;
    } else {
        nameError.textContent = "";
        nameInput.classList.remove("invalid");
        nameInput.classList.add("valid");
    }

    // --- PATH ---
    const path = pathInput.value.trim();

    let isValidPath = false;

    // internal
    if (/^\/[a-z0-9/_-]*$/i.test(path)) {
        isValidPath = true;
    }

    // external
    try {
        const url = new URL(path);
        if (url.protocol === "http:" || url.protocol === "https:") {
            isValidPath = true;
        }
    } catch {}

    if (!isValidPath) {
        pathError.textContent = "Must be /path or https://url";
        pathInput.classList.add("invalid");
        pathInput.classList.remove("valid");
        valid = false;
    } else {
        pathError.textContent = "";
        pathInput.classList.remove("invalid");
        pathInput.classList.add("valid");
    }

    return valid;
}

function showToast(message, type = "success") {
    const map = {
        success: "success",
        error: "error",
        info: "info"
    };

    const method = map[type] || "info";

    if (window.toast && window.toast[method]) {
        window.toast[method](message);
    }
}
