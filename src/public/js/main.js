async function logout() {
  if (!confirm('确定要退出登录吗？')) return;
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) window.location.href = '/login';
  } catch (e) {
    window.location.href = '/login';
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`确定要删除学生 "${name}" 的所有记录吗？此操作不可恢复！`)) return;
  try {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      window.location.reload();
    } else {
      alert('删除失败: ' + data.error);
    }
  } catch (e) {
    alert('网络错误');
  }
}

async function exportData() {
  try {
    const res = await fetch('/api/students/export');
    const data = await res.json();
    if (!data.length) {
      alert('暂无数据可导出');
      return;
    }
    const headers = ['学生姓名','性别','民族','录取类型','户籍地址','家庭详细地址','身份证号码','初中毕业学校','父亲姓名','父亲手机','母亲姓名','母亲手机','中考分数','备注','录入人','录入时间'];
    const csvRows = [headers.join(',')];
    data.forEach(s => {
      const row = [
        escapeCsv(s.student_name),
        s.gender,
        s.ethnicity,
        s.admission_type,
        escapeCsv(s.registered_address),
        escapeCsv(s.home_address),
        s.id_number,
        escapeCsv(s.middle_school),
        escapeCsv(s.father_name),
        s.father_phone,
        escapeCsv(s.mother_name),
        s.mother_phone,
        s.zhongkao_score,
        escapeCsv(s.notes),
        escapeCsv(s.creator_name || ''),
        new Date(s.created_at).toLocaleString('zh-CN')
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `招生数据_${new Date().toLocaleDateString('zh-CN')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert('导出失败');
  }
}

function escapeCsv(str) {
  if (!str) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// User management
document.addEventListener('DOMContentLoaded', function() {
  const userModal = document.getElementById('userModal');
  if (!userModal) return;

  userModal.addEventListener('show.bs.modal', loadUsers);

  document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 添加中...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        form.reset();
        loadUsers();
        alert('用户添加成功');
      } else {
        alert('添加失败: ' + result.error);
      }
    } catch (e) {
      alert('网络错误');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> 添加';
  });
});

async function loadUsers() {
  const el = document.getElementById('userList');
  if (!el) return;

  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>用户名</th><th>显示名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    users.forEach(u => {
      html += `<tr>
        <td>${u.username}</td>
        <td>${u.display_name}</td>
        <td>${u.role === 'admin' ? '管理员' : '招生人员'}</td>
        <td><span class="badge ${u.is_active ? 'bg-success' : 'bg-secondary'}">${u.is_active ? '启用' : '禁用'}</span></td>
        <td class="small">${new Date(u.created_at).toLocaleString('zh-CN')}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning" onclick="resetPassword(${u.id})" title="重置密码"><i class="bi bi-key"></i></button>
          <button class="btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}" onclick="toggleActive(${u.id})" title="${u.is_active ? '禁用' : '启用'}">
            <i class="bi bi-${u.is_active ? 'pause-circle' : 'play-circle'}"></i>
          </button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="alert alert-danger">加载用户列表失败</div>';
  }
}

async function resetPassword(id) {
  const pwd = prompt('请输入新密码（至少6位）:');
  if (!pwd || pwd.length < 6) {
    alert('密码至少6位');
    return;
  }
  try {
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const data = await res.json();
    if (data.success) {
      alert('密码重置成功');
    } else {
      alert('重置失败: ' + data.error);
    }
  } catch (e) {
    alert('网络错误');
  }
}

async function toggleActive(id) {
  if (!confirm('确定要切换该用户的状态吗？')) return;
  try {
    const res = await fetch(`/api/users/${id}/toggle-active`, {
      method: 'PUT'
    });
    const data = await res.json();
    if (data.success) {
      loadUsers();
    } else {
      alert('操作失败: ' + data.error);
    }
  } catch (e) {
    alert('网络错误');
  }
}
