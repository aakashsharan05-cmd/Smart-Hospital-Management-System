import React, { useState, useEffect } from 'react';
import { getUsers, toggleUserActive, getErrorMessage } from '../../services/api';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
  TableLoading,
} from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import {
  IoPeopleOutline,
  IoPowerOutline,
  IoRefreshOutline,
  IoSearchOutline,
} from 'react-icons/io5';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsersList = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getUsers();
      setUsers(res.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  const handleToggleActive = async (userId) => {
    setActionLoadingId(userId);
    try {
      await toggleUserActive(userId);
      await fetchUsersList();
    } catch (err) {
      console.error('Error toggling user status:', err);
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      return matchName || matchEmail;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage System Users</h1>
          <p className="text-sm text-slate-500">
            View all registered patients, physicians, receptionists, and system administrators
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={IoRefreshOutline}
          onClick={fetchUsersList}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <Input
              icon={IoSearchOutline}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              placeholder=""
            >
              <option value="all">All Roles</option>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredUsers.length} of {users.length} users
        </span>
      </div>

      {/* Users Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>User Name</TableHeader>
              <TableHeader>Email Address</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Account Status</TableHeader>
              <TableHeader>Joined Date</TableHeader>
              <TableHeader className="text-right">Action</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={6} />
            ) : filteredUsers.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message="No users found matching your criteria."
                icon={IoPeopleOutline}
              />
            ) : (
              filteredUsers.map((user) => {
                const isToggling = actionLoadingId === user._id;
                const isActive = user.isActive !== false;
                const dateObj = new Date(user.createdAt || Date.now());

                return (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell className="text-slate-700">{user.email}</TableCell>
                    <TableCell>
                      <Badge status={user.role} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        status={isActive ? 'active' : 'inactive'}
                        variant={isActive ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={isActive ? 'ghost' : 'success'}
                        size="sm"
                        icon={IoPowerOutline}
                        isLoading={isToggling}
                        onClick={() => handleToggleActive(user._id)}
                        className={isActive ? 'text-amber-600 hover:text-amber-700' : ''}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default ManageUsers;
