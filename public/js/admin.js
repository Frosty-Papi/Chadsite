function getCSRF(){return document.querySelector('meta[name="csrf-token"]')?.content||""}

async function api(url,body){
    const res=await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json","CSRF-Token":getCSRF()},
        body:JSON.stringify(body)
    });
    if(!res.ok){
        let msg="Request failed";
        try{const j=await res.json();msg=j.error||msg}catch{}
        alert(msg);
        throw new Error(msg);
    }
    return res.json().catch(()=>({}));
}

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

    // tabs
    document.querySelectorAll("[data-tab]").forEach(btn=>{
        btn.addEventListener("click",()=>{
            document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
            document.getElementById("tab-"+btn.dataset.tab)?.classList.remove("hidden");
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

    document.querySelectorAll(".delete-service-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            if(!confirm("Delete this service?"))return;
            await api("/admin/service/delete",{serviceId:btn.dataset.id});
            location.reload();
        });
    });

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
            alert(text);
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
